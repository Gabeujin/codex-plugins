import {
  canonicalizeUrl,
  decodeEntities,
  parseDate,
  stripHtml,
  truncate
} from "./text.mjs";

function firstTag(block, names) {
  for (const name of names) {
    const match = block.match(
      new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i")
    );
    if (match) {
      return decodeEntities(match[1].trim());
    }
  }
  return "";
}

function allTagValues(block, name) {
  return [
    ...block.matchAll(
      new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "gi")
    )
  ].map((match) => decodeEntities(match[1].trim()));
}

function attributeValue(tag, name) {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i")
  );
  return decodeEntities(match?.[1] ?? match?.[2] ?? "");
}

function atomLink(block) {
  const tags = block.match(/<link\b[^>]*\/?>/gi) ?? [];
  const alternate =
    tags.find((tag) => {
      const rel = attributeValue(tag, "rel");
      return !rel || rel.toLowerCase() === "alternate";
    }) ?? tags[0];
  return alternate ? attributeValue(alternate, "href") : "";
}

function atomAuthor(block) {
  const authorBlock = block.match(/<author\b[^>]*>([\s\S]*?)<\/author>/i)?.[1];
  return authorBlock ? stripHtml(firstTag(authorBlock, ["name"])) : "";
}

export function parseFeed(xml, format = "rss", baseUrl) {
  const atom = format === "atom" || /<feed\b/i.test(xml);
  const pattern = atom
    ? /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi
    : /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  const items = [];

  for (const match of String(xml).matchAll(pattern)) {
    const block = match[1];
    const rawLink = atom
      ? atomLink(block) || firstTag(block, ["id"])
      : firstTag(block, ["link", "guid"]);
    if (!rawLink) {
      continue;
    }
    let canonicalUrl;
    try {
      canonicalUrl = canonicalizeUrl(stripHtml(rawLink), baseUrl);
    } catch {
      continue;
    }
    const categoryTerms = (block.match(/<category\b[^>]*\/?>/gi) ?? [])
      .map((tag) => attributeValue(tag, "term"))
      .filter(Boolean);
    const categoryBodies = allTagValues(block, "category")
      .map(stripHtml)
      .filter(Boolean);
    const content = firstTag(block, [
      "description",
      "summary",
      "content:encoded",
      "content"
    ]);
    const author = atom
      ? atomAuthor(block)
      : stripHtml(firstTag(block, ["dc:creator", "author"]));

    items.push({
      canonicalUrl,
      title: truncate(stripHtml(firstTag(block, ["title"])), 300),
      summary: truncate(stripHtml(content), 600),
      publishedAt: parseDate(
        firstTag(block, ["pubDate", "published", "dc:date", "updated"])
      ),
      publisherUpdatedAt: parseDate(firstTag(block, ["updated"])),
      authors: author ? [author] : [],
      tags: [...new Set([...categoryTerms, ...categoryBodies])],
      metadataState: "feed-metadata"
    });
  }

  return items;
}

export function parseSitemap(xml) {
  const sitemapIndex = /<sitemapindex\b/i.test(xml);
  const elementName = sitemapIndex ? "sitemap" : "url";
  const pattern = new RegExp(
    `<${elementName}\\b[^>]*>([\\s\\S]*?)<\\/${elementName}>`,
    "gi"
  );
  const records = [];

  for (const match of String(xml).matchAll(pattern)) {
    const block = match[1];
    const loc = stripHtml(firstTag(block, ["loc"]));
    if (!loc) {
      continue;
    }
    records.push({
      loc,
      lastmod: parseDate(firstTag(block, ["lastmod"]))
    });
  }

  return {
    type: sitemapIndex ? "index" : "urlset",
    records
  };
}

export function extractMatchingLinks(html, baseUrl, pattern) {
  const matcher = pattern instanceof RegExp ? pattern : new RegExp(pattern, "i");
  const links = [];
  for (const match of String(html).matchAll(
    /<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>/gi
  )) {
    try {
      const url = canonicalizeUrl(match[1] ?? match[2], baseUrl);
      if (matcher.test(url)) {
        links.push(url);
      }
      matcher.lastIndex = 0;
    } catch {
      // Ignore invalid or non-HTTP links.
    }
  }
  return [...new Set(links)];
}
