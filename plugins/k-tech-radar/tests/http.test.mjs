import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAllowedUrl,
  assertPublicResolution,
  isRobotsAllowed
} from "../lib/http.mjs";
import { resolveArticleUrl } from "../lib/collector.mjs";

test("collection URLs require HTTPS and an exact configured host", () => {
  assert.equal(
    assertAllowedUrl(
      "https://tech.socar.kr/dev/example",
      ["tech.socar.kr"]
    ).hostname,
    "tech.socar.kr"
  );
  assert.throws(
    () =>
      assertAllowedUrl(
        "http://127.0.0.1:4380/private",
        ["tech.socar.kr"]
      ),
    /Only HTTPS|Private or local/
  );
  assert.throws(
    () =>
      assertAllowedUrl(
        "https://attacker.example/private",
        ["tech.socar.kr"]
      ),
    /outside the configured source allowlist/
  );
  assert.throws(
    () =>
      assertAllowedUrl(
        "https://[::ffff:127.0.0.1]/private",
        ["[::ffff:7f00:1]"]
      ),
    /Private or local/
  );
});

test("unsafe publisher canonical metadata falls back to discovered URL", () => {
  const source = {
    id: "socar-tech",
    homepage: "https://tech.socar.kr/",
    adapter: {
      type: "sitemap",
      url: "https://tech.socar.kr/sitemap.xml",
      articleUrlPattern: "^https://tech\\.socar\\.kr/dev/"
    }
  };
  assert.equal(
    resolveArticleUrl(source, {
      canonicalUrl: "http://127.0.0.1:4380/private",
      discoveredUrl: "https://tech.socar.kr/dev/safe"
    }),
    "https://tech.socar.kr/dev/safe"
  );
});

test("robots rules use longest matching allow or disallow path", () => {
  const robots = `
User-agent: *
Disallow: /api/
Allow: /api/public/
`;
  assert.equal(
    isRobotsAllowed(
      robots,
      new URL("https://tech.socar.kr/api/private"),
      "K-Tech-Radar/0.3.0"
    ),
    false
  );
  assert.equal(
    isRobotsAllowed(
      robots,
      new URL("https://tech.socar.kr/api/public/status"),
      "K-Tech-Radar/0.3.0"
    ),
    true
  );
});

test("DNS resolution fails closed on private or reserved addresses", async () => {
  const lookupPrivate = async () => [
    { address: "127.0.0.1", family: 4 }
  ];
  const lookupPublic = async () => [
    { address: "203.0.114.10", family: 4 }
  ];

  await assert.rejects(
    assertPublicResolution(
      "https://tech.socar.kr/post",
      lookupPrivate
    ),
    /private or reserved/
  );
  assert.deepEqual(
    await assertPublicResolution(
      "https://tech.socar.kr/post",
      lookupPublic
    ),
    ["203.0.114.10"]
  );
});
