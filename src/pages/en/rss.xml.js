import rss from "@astrojs/rss";
import { getBlogEntries, getLocalizedSlug, getPostPath } from "../../lib/blog";

export async function GET(context) {
  const posts = await getBlogEntries("en");

  return rss({
    title: "Haoyue Bai",
    description: "English blog RSS",
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: getPostPath("en", getLocalizedSlug(post))
    }))
  });
}
