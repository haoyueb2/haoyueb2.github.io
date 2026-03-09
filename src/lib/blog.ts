import { getCollection, type CollectionEntry } from "astro:content";

export type Locale = "zh" | "en";

export type BlogEntry = CollectionEntry<"blog">;

export const localeLabels: Record<Locale, string> = {
  zh: "中文",
  en: "EN"
};

export function getEntryLocale(entry: BlogEntry): Locale {
  return entry.id.startsWith("en/") ? "en" : "zh";
}

export function getLocalizedSlug(entry: BlogEntry): string {
  return entry.id.replace(/^(zh|en)\//, "").replace(/\.(md|mdx)$/, "").replace(/\/index$/, "");
}

export function getLocalizedPath(locale: Locale, slug = ""): string {
  const normalized = slug.replace(/^\/+|\/+$/g, "");
  if (locale === "zh") {
    return normalized ? `/${normalized}/` : "/";
  }
  return normalized ? `/en/${normalized}/` : "/en/";
}

export async function getBlogEntries(locale: Locale): Promise<BlogEntry[]> {
  const entries = await getCollection("blog", ({ data }) => !data.draft);
  return entries
    .filter((entry) => getEntryLocale(entry) === locale)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getTranslationMap(): Promise<Map<string, Partial<Record<Locale, BlogEntry>>>> {
  const entries = await getCollection("blog", ({ data }) => !data.draft);
  const map = new Map<string, Partial<Record<Locale, BlogEntry>>>();
  for (const entry of entries) {
    const locale = getEntryLocale(entry);
    const existing = map.get(entry.data.translationKey) ?? {};
    existing[locale] = entry;
    map.set(entry.data.translationKey, existing);
  }
  return map;
}

export async function getTranslatedEntry(entry: BlogEntry, locale: Locale): Promise<BlogEntry | undefined> {
  const map = await getTranslationMap();
  return map.get(entry.data.translationKey)?.[locale];
}

export async function getTags(locale: Locale): Promise<string[]> {
  const entries = await getBlogEntries(locale);
  return [...new Set(entries.flatMap((entry) => entry.data.tags))].sort((a, b) =>
    a.localeCompare(b, locale === "zh" ? "zh-Hans" : "en")
  );
}

export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

export function getPostsIndexPath(locale: Locale): string {
  return getLocalizedPath(locale, "posts");
}

export function getPostPath(locale: Locale, slug: string): string {
  return getLocalizedPath(locale, `posts/${slug}`);
}

export function getTagPath(locale: Locale, tag: string): string {
  return getLocalizedPath(locale, `tags/${encodeURIComponent(tag)}`);
}

export function getAboutPath(locale: Locale): string {
  return getLocalizedPath(locale, "about");
}

export function getRssPath(locale: Locale): string {
  return locale === "zh" ? "/rss.xml" : "/en/rss.xml";
}
