import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const requestQueueByHost = new Map();
const lastRequestStartedByHost = new Map();
const pendingRequestsByHost = new Map();
const robotsCache = new Map();
const MAX_PENDING_REQUESTS_PER_HOST = 20;

function abortReason(signal) {
  return signal?.reason instanceof Error
    ? signal.reason
    : new Error("Collection request was aborted");
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw abortReason(signal);
  }
}

function sleep(milliseconds, signal) {
  throwIfAborted(signal);
  if (!signal) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortReason(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function combinedRequestSignal(timeoutMs, signal) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return signal
    ? AbortSignal.any([timeoutSignal, signal])
    : timeoutSignal;
}

export function privateOrReservedIp(hostname) {
  const address = String(hostname)
    .replace(/^\[|\]$/g, "")
    .toLowerCase();
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }
  if (isIP(address) === 6) {
    const value = address;
    const mapped = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) {
      return privateOrReservedIp(mapped[1]);
    }
    const mappedHex = value.match(
      /::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/
    );
    if (mappedHex) {
      const high = Number.parseInt(mappedHex[1], 16);
      const low = Number.parseInt(mappedHex[2], 16);
      return privateOrReservedIp(
        [
          high >> 8,
          high & 255,
          low >> 8,
          low & 255
        ].join(".")
      );
    }
    return (
      value === "::1" ||
      value === "::" ||
      value.startsWith("fc") ||
      value.startsWith("fd") ||
      value.startsWith("fe8") ||
      value.startsWith("fe9") ||
      value.startsWith("fea") ||
      value.startsWith("feb") ||
      value.startsWith("2001:db8:") ||
      value.startsWith("64:ff9b:1:") ||
      value.startsWith("ff")
    );
  }
  return false;
}

export function assertAllowedUrl(value, allowedHosts) {
  const url = value instanceof URL ? new URL(value) : new URL(String(value));
  const allowed = new Set(
    [...(allowedHosts ?? [])].map((host) => String(host).toLowerCase())
  );
  const hostname = url.hostname.toLowerCase();

  if (url.protocol !== "https:") {
    throw new Error(`Only HTTPS collection URLs are allowed: ${url.href}`);
  }
  if (url.username || url.password) {
    throw new Error(`Credentials are not allowed in collection URLs: ${url.href}`);
  }
  if (url.port && url.port !== "443") {
    throw new Error(`Non-standard ports are not allowed: ${url.href}`);
  }
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    privateOrReservedIp(hostname)
  ) {
    throw new Error(`Private or local collection host is not allowed: ${hostname}`);
  }
  if (!allowed.size || !allowed.has(hostname)) {
    throw new Error(
      `Collection host ${hostname} is outside the configured source allowlist`
    );
  }
  return url;
}

export async function assertPublicResolution(
  value,
  lookupImplementation = lookup
) {
  const url = value instanceof URL ? value : new URL(String(value));
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname)) {
    if (privateOrReservedIp(hostname)) {
      throw new Error(
        `Resolved collection address is private or reserved: ${hostname}`
      );
    }
    return [hostname];
  }
  const records = await lookupImplementation(url.hostname, {
    all: true,
    verbatim: true
  });
  if (!Array.isArray(records) || !records.length) {
    throw new Error(`Collection host did not resolve: ${url.hostname}`);
  }
  const addresses = records.map((record) => record.address);
  const blocked = addresses.filter(privateOrReservedIp);
  if (blocked.length) {
    throw new Error(
      `Collection host resolved to a private or reserved address: ${blocked.join(", ")}`
    );
  }
  return addresses;
}

function queueForHost(url, requestIntervalMs, task, signal) {
  throwIfAborted(signal);
  const hostname = url.hostname.toLowerCase();
  const pending = pendingRequestsByHost.get(hostname) ?? 0;
  if (pending >= MAX_PENDING_REQUESTS_PER_HOST) {
    throw new Error(
      `Collection queue is full for ${hostname}; retry after current requests finish`
    );
  }
  pendingRequestsByHost.set(hostname, pending + 1);
  const previous = requestQueueByHost.get(hostname) ?? Promise.resolve();
  const queued = previous
    .catch(() => undefined)
    .then(async () => {
      throwIfAborted(signal);
      const lastStarted = lastRequestStartedByHost.get(hostname) ?? 0;
      const waitFor = Math.max(
        0,
        requestIntervalMs - (Date.now() - lastStarted)
      );
      if (waitFor > 0) {
        await sleep(waitFor, signal);
      }
      throwIfAborted(signal);
      lastRequestStartedByHost.set(hostname, Date.now());
      return task();
    });
  requestQueueByHost.set(hostname, queued);
  return queued.finally(() => {
    const remaining = (pendingRequestsByHost.get(hostname) ?? 1) - 1;
    if (remaining > 0) {
      pendingRequestsByHost.set(hostname, remaining);
    } else {
      pendingRequestsByHost.delete(hostname);
    }
  });
}

function retryAfterMilliseconds(value, attempt) {
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.min(Math.max(0, seconds * 1000), 120_000);
  }
  const date = value ? Date.parse(value) : Number.NaN;
  if (!Number.isNaN(date)) {
    return Math.min(Math.max(0, date - Date.now()), 120_000);
  }
  return Math.min(1000 * 2 ** attempt, 8_000);
}

async function requestWithRedirects(
  initialUrl,
  {
    allowedHosts,
    userAgent,
    requestIntervalMs,
    timeoutMs,
    maxRedirects,
    signal
  }
) {
  let currentUrl = assertAllowedUrl(initialUrl, allowedHosts);

  for (let redirectCount = 0; ; redirectCount += 1) {
    throwIfAborted(signal);
    await assertPublicResolution(currentUrl);
    throwIfAborted(signal);
    const response = await queueForHost(
      currentUrl,
      requestIntervalMs,
      async () => {
        return fetch(currentUrl, {
          redirect: "manual",
          signal: combinedRequestSignal(timeoutMs, signal),
          headers: {
            accept:
              "application/rss+xml, application/atom+xml, application/xml, text/xml, text/plain, text/html;q=0.9, */*;q=0.5",
            "user-agent": userAgent
          }
        });
      },
      signal
    );

    if (
      response.status < 300 ||
      response.status >= 400 ||
      !response.headers.get("location")
    ) {
      return { response, finalUrl: currentUrl };
    }
    if (redirectCount >= maxRedirects) {
      await response.body?.cancel();
      throw new Error(`Too many redirects while collecting ${initialUrl}`);
    }
    const redirected = new URL(response.headers.get("location"), currentUrl);
    await response.body?.cancel();
    currentUrl = assertAllowedUrl(redirected, allowedHosts);
  }
}

async function requestWithRetries(url, options) {
  let result;
  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    result = await requestWithRedirects(url, options);
    const { response } = result;
    const retryable =
      response.status === 429 ||
      (response.status >= 500 && response.status <= 599);
    if (!retryable || attempt >= options.maxRetries) {
      return result;
    }
    const retryDelay = retryAfterMilliseconds(
      response.headers.get("retry-after"),
      attempt
    );
    await response.body?.cancel();
    await sleep(retryDelay, options.signal);
  }
  return result;
}

function parseRobotsGroups(text) {
  const groups = [];
  let current = null;
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line || !line.includes(":")) {
      continue;
    }
    const separator = line.indexOf(":");
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === "user-agent") {
      if (!current || current.rules.length) {
        current = { userAgents: [], rules: [] };
        groups.push(current);
      }
      current.userAgents.push(value.toLowerCase());
      continue;
    }
    if (
      current &&
      (field === "allow" || field === "disallow") &&
      value
    ) {
      current.rules.push({
        allow: field === "allow",
        pattern: value
      });
    }
  }
  return groups;
}

function robotsPatternMatches(pattern, path) {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const expression = body
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll("*", ".*");
  return new RegExp(`^${expression}${anchored ? "$" : ""}`).test(path);
}

export function isRobotsAllowed(text, url, userAgent = "K-Tech-Radar/0.3.0") {
  const groups = parseRobotsGroups(text);
  const token = userAgent.toLowerCase().split(/[\/\s]/)[0];
  const matches = groups
    .map((group) => {
      const specific = group.userAgents
        .filter((agent) => agent !== "*" && token.includes(agent))
        .reduce((length, agent) => Math.max(length, agent.length), 0);
      const wildcard = group.userAgents.includes("*") ? 1 : 0;
      return { group, specificity: specific || wildcard };
    })
    .filter((item) => item.specificity > 0);
  if (!matches.length) {
    return true;
  }
  const bestSpecificity = Math.max(
    ...matches.map((item) => item.specificity)
  );
  const path = `${url.pathname}${url.search}`;
  const rules = matches
    .filter((item) => item.specificity === bestSpecificity)
    .flatMap((item) => item.group.rules)
    .filter((rule) => robotsPatternMatches(rule.pattern, path))
    .sort(
      (left, right) =>
        right.pattern.length - left.pattern.length ||
        Number(right.allow) - Number(left.allow)
    );
  return rules[0]?.allow ?? true;
}

async function readBounded(response, maxBytes, url) {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) {
    await response.body?.cancel();
    throw new Error(
      `Response too large for metadata collection (${contentLength} bytes): ${url}`
    );
  }
  if (!response.body) {
    return new ArrayBuffer(0);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel(
          `Response exceeded ${maxBytes} byte collection limit`
        );
        throw new Error(
          `Response exceeded ${maxBytes} byte collection limit: ${url}`
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined.buffer;
}

async function assertRobotsAccess(url, options) {
  const origin = url.origin;
  let cached = robotsCache.get(origin);
  if (!cached || cached.expiresAt <= Date.now()) {
    const robotsUrl = new URL("/robots.txt", origin);
    const { response } = await requestWithRetries(robotsUrl, {
      ...options,
      maxBytes: 512_000,
      maxRetries: Math.min(options.maxRetries, 1)
    });
    if (response.status === 404 || response.status === 410) {
      cached = { text: "", denyAll: false, expiresAt: Date.now() + 3_600_000 };
    } else if (response.status === 401 || response.status === 403) {
      await response.body?.cancel();
      cached = { text: "", denyAll: true, expiresAt: Date.now() + 600_000 };
    } else if (!response.ok) {
      await response.body?.cancel();
      throw new Error(
        `Robots policy unavailable (HTTP ${response.status}) for ${origin}`
      );
    } else {
      const bytes = await readBounded(response, 512_000, robotsUrl.href);
      cached = {
        text: new TextDecoder("utf-8").decode(bytes),
        denyAll: false,
        expiresAt: Date.now() + 3_600_000
      };
    }
    robotsCache.set(origin, cached);
  }
  if (
    cached.denyAll ||
    !isRobotsAllowed(cached.text, url, options.userAgent)
  ) {
    throw new Error(`Robots policy disallows collection of ${url.href}`);
  }
}

export async function fetchText(
  url,
  {
    sourceId = "unknown",
    allowedHosts,
    userAgent = "K-Tech-Radar/0.3.0",
    requestIntervalMs = 650,
    timeoutMs = 25_000,
    maxBytes = 6_000_000,
    maxRetries = 2,
    maxRedirects = 5,
    respectRobots = true,
    signal
  } = {}
) {
  const safeUrl = assertAllowedUrl(url, allowedHosts);
  const options = {
    sourceId,
    allowedHosts,
    userAgent,
    requestIntervalMs,
    timeoutMs,
    maxBytes,
    maxRetries,
    maxRedirects,
    signal
  };
  if (respectRobots) {
    await assertRobotsAccess(safeUrl, options);
  }
  const { response, finalUrl } = await requestWithRetries(safeUrl, options);

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`HTTP ${response.status} for ${safeUrl.href}`);
  }
  const arrayBuffer = await readBounded(response, maxBytes, finalUrl.href);

  return {
    url: finalUrl.href,
    text: new TextDecoder("utf-8").decode(arrayBuffer),
    contentType: response.headers.get("content-type") ?? "",
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified")
  };
}
