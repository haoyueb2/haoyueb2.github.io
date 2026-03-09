import rss from "@astrojs/rss";
import { getBlogEntries, getLocalizedSlug, getPostPath } from "../lib/blog";

export async function GET(context) {
  const posts = await getBlogEntries("zh");

  return rss({
    title: "Haoyue Bai",
    description: "中文博客 RSS",
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: getPostPath("zh", getLocalizedSlug(post))
    }))
  });
}
