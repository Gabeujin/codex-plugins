import { createHash } from "node:crypto";

const namedEntities = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", "\""],
  ["apos", "'"],
  ["nbsp", " "],
  ["hellip", "…"],
  ["middot", "·"],
  ["ndash", "–"],
  ["mdash", "—"],
  ["lsquo", "‘"],
  ["rsquo", "’"],
  ["ldquo", "“"],
  ["rdquo", "”"]
]);

function decodeNumericEntity(value, radix) {
  const codePoint = Number.parseInt(value, radix);
  if (
    !Number.isSafeInteger(codePoint) ||
    codePoint <= 0 ||
    codePoint > 0x10ffff ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff)
  ) {
    return "\uFFFD";
  }
  return String.fromCodePoint(codePoint);
}

export function decodeEntities(value = "") {
  return String(value)
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/i, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      decodeNumericEntity(hex, 16)
    )
    .replace(/&#([0-9]+);/g, (_, decimal) =>
      decodeNumericEntity(decimal, 10)
    )
    .replace(/&([a-z]+);/gi, (match, name) =>
      namedEntities.get(name.toLowerCase()) ?? match
    );
}

export function stripHtml(value = "") {
  return decodeEntities(
    String(value)
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|li|h[1-6]|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\r/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function truncate(value = "", maxLength = 1200) {
  const text = String(value).trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function canonicalizeUrl(value, baseUrl) {
  const url = new URL(value, baseUrl);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (
      key.toLowerCase().startsWith("utm_") ||
      ["fbclid", "gclid", "ref", "source"].includes(key.toLowerCase())
    ) {
      url.searchParams.delete(key);
    }
  }
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.toString();
}

export function slugify(value, maxLength = 48) {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "") || "entry";
}

export function normalizeSearchText(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, "\"");
}

export function tokenize(value = "") {
  const normalized = normalizeSearchText(value);
  const chunks =
    normalized.match(/[a-z0-9][a-z0-9.+#/_-]*|[가-힣]{2,}/g) ?? [];
  const tokens = [];

  for (const chunk of chunks) {
    const cleaned = chunk.replace(/^[-_/]+|[-_/]+$/g, "");
    if (cleaned.length < 2) {
      continue;
    }
    tokens.push(cleaned);
    if (/^[가-힣]{3,}$/.test(cleaned)) {
      for (let index = 0; index < cleaned.length - 1; index += 1) {
        tokens.push(`ko:${cleaned.slice(index, index + 2)}`);
      }
    }
  }

  return tokens;
}

export function parseDate(value) {
  if (!value) {
    return null;
  }
  const time = Date.parse(String(value).trim());
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function attributeValue(tag, name) {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i")
  );
  return decodeEntities(match?.[1] ?? match?.[2] ?? "");
}

export function extractMeta(html, key) {
  const tags = String(html).match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const property = attributeValue(tag, "property");
    const name = attributeValue(tag, "name");
    if (
      property.toLowerCase() === key.toLowerCase() ||
      name.toLowerCase() === key.toLowerCase()
    ) {
      return attributeValue(tag, "content");
    }
  }
  return "";
}

function findArticleJsonLd(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findArticleJsonLd(item);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  if (Array.isArray(value["@graph"])) {
    return findArticleJsonLd(value["@graph"]);
  }
  const types = Array.isArray(value["@type"])
    ? value["@type"]
    : [value["@type"]];
  if (
    types.some((type) =>
      ["Article", "BlogPosting", "TechArticle", "NewsArticle"].includes(type)
    )
  ) {
    return value;
  }
  return null;
}

export function extractJsonLdArticle(html) {
  const scripts = [
    ...String(html).matchAll(
      /<script\b[^>]*type\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/gi
    )
  ];
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(decodeEntities(match[1]).trim());
      const article = findArticleJsonLd(parsed);
      if (article) {
        return article;
      }
    } catch {
      // Ignore malformed third-party JSON-LD blocks and continue.
    }
  }
  return null;
}

function authorNames(author) {
  const authors = Array.isArray(author) ? author : author ? [author] : [];
  return authors
    .map((item) => (typeof item === "string" ? item : item?.name))
    .filter(Boolean)
    .map((item) => stripHtml(item));
}

function keywordList(value) {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return String(value ?? "")
    .split(/[,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function extractPageMetadata(html, url) {
  const jsonLd = extractJsonLdArticle(html);
  const title =
    extractMeta(html, "og:title") ||
    extractMeta(html, "twitter:title") ||
    jsonLd?.headline ||
    stripHtml(String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const summary =
    extractMeta(html, "og:description") ||
    extractMeta(html, "description") ||
    extractMeta(html, "twitter:description") ||
    jsonLd?.description ||
    "";
  const publishedAt =
    extractMeta(html, "article:published_time") ||
    jsonLd?.datePublished ||
    String(html).match(/<time\b[^>]*datetime\s*=\s*(?:"([^"]+)"|'([^']+)')/i)?.[1] ||
    stripHtml(
      String(html).match(/<time\b[^>]*>([\s\S]*?)<\/time>/i)?.[1] ?? ""
    ) ||
    "";
  const publisherUpdatedAt =
    extractMeta(html, "article:modified_time") ||
    jsonLd?.dateModified ||
    "";
  const canonical =
    String(html).match(
      /<link\b[^>]*rel\s*=\s*(?:"canonical"|'canonical')[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)')/i
    )?.[1] ||
    String(html).match(
      /<link\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*rel\s*=\s*(?:"canonical"|'canonical')/i
    )?.[1] ||
    jsonLd?.url ||
    url;
  const metaTags = (String(html).match(/<meta\b[^>]*>/gi) ?? [])
    .filter((tag) => attributeValue(tag, "property").toLowerCase() === "article:tag")
    .map((tag) => attributeValue(tag, "content"))
    .filter(Boolean);

  return {
    title: truncate(stripHtml(title), 300),
    summary: truncate(stripHtml(summary), 1200),
    publishedAt: parseDate(publishedAt),
    publisherUpdatedAt: parseDate(publisherUpdatedAt),
    canonicalUrl: canonicalizeUrl(canonical, url),
    authors: authorNames(jsonLd?.author),
    tags: [...new Set([...metaTags, ...keywordList(jsonLd?.keywords)])],
    pageKind:
      extractMeta(html, "og:type").toLowerCase() ||
      (jsonLd ? "article" : "unknown"),
    metadataState: title ? "page-metadata" : "url-only"
  };
}

export function extractReadableText(html) {
  const cleaned = String(html)
    .replace(/<header\b[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form\b[\s\S]*?<\/form>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ");
  const article =
    cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ||
    cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ||
    cleaned.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ||
    cleaned;
  return stripHtml(article);
}

export function extractReadableExcerpt(html, maxChars = 3000) {
  return truncate(extractReadableText(html), maxChars);
}

export function extractEvidenceExcerpt(html, maxChars = 3000) {
  const text = extractReadableText(html);
  const proportionalLimit = Math.max(1, Math.floor(text.length * 0.6));
  return truncate(text, Math.min(maxChars, proportionalLimit));
}

export function titleFromUrl(url) {
  const path = new URL(url).pathname.replace(/\/+$/, "");
  const segment = path.split("/").filter(Boolean).at(-1) ?? "article";
  return decodeURIComponent(segment)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
