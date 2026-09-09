import { readJson, taxonomyPath } from "./paths.mjs";
import { normalizeSearchText } from "./text.mjs";

export function loadTaxonomy() {
  return readJson(taxonomyPath);
}

function rankConcepts(text, concepts, limit) {
  const normalized = normalizeSearchText(text);
  return concepts
    .map((concept) => {
      const matches = concept.keywords.reduce((score, keyword) => {
        const needle = normalizeSearchText(keyword);
        const asciiOnly = /^[a-z0-9.+#/_-]+$/.test(needle);
        const koreanOnly = /^[가-힣]+$/.test(needle);
        const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const found = asciiOnly
          ? new RegExp(
              `(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`,
              "i"
            ).test(normalized)
          : koreanOnly && needle.length <= 3
            ? new RegExp(`(^|[^가-힣])${escaped}([^가-힣]|$)`).test(
                normalized
              )
            : normalized.includes(needle);
        if (!needle || !found) {
          return score;
        }
        const titleLikeBoost = normalized.startsWith(needle) ? 1 : 0;
        return score + 1 + titleLikeBoost;
      }, 0);
      return { id: concept.id, score: matches };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((item) => item.id);
}

export async function classifyArticle(
  article,
  suppliedTaxonomy = null
) {
  const taxonomy =
    suppliedTaxonomy ?? (await loadTaxonomy());
  const text = [
    article.title,
    article.summary,
    ...(article.tags ?? [])
  ].join(" ");

  return {
    domainIds: rankConcepts(text, taxonomy.domains, 3),
    problemTypeIds: rankConcepts(text, taxonomy.problemTypes, 3)
  };
}

export function conceptMap(taxonomy) {
  return {
    domains: Object.fromEntries(
      taxonomy.domains.map((item) => [item.id, item])
    ),
    problemTypes: Object.fromEntries(
      taxonomy.problemTypes.map((item) => [item.id, item])
    )
  };
}
