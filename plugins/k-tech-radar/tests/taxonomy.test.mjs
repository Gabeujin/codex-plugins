import assert from "node:assert/strict";
import test from "node:test";

import { classifyArticle } from "../lib/taxonomy.mjs";

test("classification uses the supplied current taxonomy instead of a process-lifetime cache", async () => {
  const article = {
    title: "Kafka consumer 운영",
    summary: "",
    tags: []
  };
  const first = await classifyArticle(article, {
    domains: [
      {
        id: "old-domain",
        keywords: ["Kafka"]
      }
    ],
    problemTypes: []
  });
  const second = await classifyArticle(article, {
    domains: [
      {
        id: "new-domain",
        keywords: ["Kafka"]
      }
    ],
    problemTypes: []
  });
  assert.deepEqual(first.domainIds, ["old-domain"]);
  assert.deepEqual(second.domainIds, ["new-domain"]);
});
