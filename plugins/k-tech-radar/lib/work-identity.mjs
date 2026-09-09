import {
  normalizeSearchText,
  sha256
} from "./text.mjs";

function normalizedWorkText(article) {
  return [
    normalizeSearchText(article.title ?? ""),
    normalizeSearchText(article.summary ?? "")
  ]
    .filter(Boolean)
    .join("\n");
}

export function derivedCanonicalWorkId(article) {
  const normalized = normalizedWorkText(article);
  if (normalized) {
    return `work:derived:${sha256(normalized).slice(0, 32)}`;
  }
  const fallback =
    article.articleId ??
    article.canonicalUrl ??
    "unidentified-work";
  return `work:fallback:${sha256(String(fallback)).slice(0, 32)}`;
}

export function validateWorkRelations(source) {
  const relations = source.workRelations ?? [];
  if (!Array.isArray(relations)) {
    throw new Error(
      `${source.id}.workRelations must be an array`
    );
  }
  const seenUrls = new Set();
  return relations.map((relation, index) => {
    if (
      !relation ||
      typeof relation !== "object" ||
      Array.isArray(relation)
    ) {
      throw new Error(
        `${source.id}.workRelations[${index}] must be an object`
      );
    }
    const unknown = Object.keys(relation).filter(
      (key) =>
        ![
          "canonicalUrl",
          "canonicalWorkId",
          "translationOf",
          "independenceStatus"
        ].includes(key)
    );
    if (unknown.length) {
      throw new Error(
        `${source.id}.workRelations[${index}] contains unsupported fields: ${unknown.join(", ")}`
      );
    }
    const canonicalUrl = String(
      relation.canonicalUrl ?? ""
    );
    let parsedUrl;
    try {
      parsedUrl = new URL(canonicalUrl);
    } catch {
      throw new Error(
        `${source.id}.workRelations[${index}].canonicalUrl is invalid`
      );
    }
    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.hash ||
      !new RegExp(
        source.adapter.articleUrlPattern,
        "i"
      ).test(canonicalUrl)
    ) {
      throw new Error(
        `${source.id}.workRelations[${index}].canonicalUrl is outside the official article boundary`
      );
    }
    if (seenUrls.has(canonicalUrl)) {
      throw new Error(
        `${source.id}.workRelations contains duplicate canonicalUrl values`
      );
    }
    seenUrls.add(canonicalUrl);
    const canonicalWorkId = String(
      relation.canonicalWorkId ?? ""
    );
    const translationOf =
      relation.translationOf === undefined ||
      relation.translationOf === null
        ? null
        : String(relation.translationOf);
    for (const [field, value] of [
      ["canonicalWorkId", canonicalWorkId],
      ["translationOf", translationOf]
    ]) {
      if (
        value !== null &&
        !/^[a-z0-9][a-z0-9:._-]{2,180}$/u.test(
          value
        )
      ) {
        throw new Error(
          `${source.id}.workRelations[${index}].${field} is invalid`
        );
      }
    }
    const independenceStatus =
      relation.independenceStatus ??
      (translationOf
        ? "related-copy"
        : "review-required");
    if (
      ![
        "confirmed-original",
        "related-copy",
        "review-required"
      ].includes(independenceStatus) ||
      (translationOf &&
        independenceStatus ===
          "confirmed-original") ||
      (!translationOf &&
        independenceStatus === "related-copy")
    ) {
      throw new Error(
        `${source.id}.workRelations[${index}].independenceStatus is inconsistent`
      );
    }
    return {
      canonicalUrl,
      canonicalWorkId,
      translationOf,
      independenceStatus
    };
  });
}

export function configuredWorkIdentity(
  source,
  canonicalUrl,
  article
) {
  const relation = validateWorkRelations(source).find(
    (candidate) =>
      candidate.canonicalUrl === canonicalUrl
  );
  return {
    canonicalWorkId:
      relation?.canonicalWorkId ??
      derivedCanonicalWorkId(article),
    translationOf: relation?.translationOf ?? null,
    workIdentityBasis: relation
      ? "curated"
      : "derived-metadata",
    workIndependenceStatus:
      relation?.independenceStatus ??
      "review-required"
  };
}

export function workFamily(article) {
  return (
    article.translationOf ??
    article.canonicalWorkId ??
    derivedCanonicalWorkId(article)
  );
}

export function workIndependenceStatus(article) {
  if (article.translationOf) {
    return "related-copy";
  }
  return article.workIndependenceStatus ===
    "confirmed-original"
    ? "confirmed-original"
    : "review-required";
}
