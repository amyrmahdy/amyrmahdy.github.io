import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function get(context) {
  const blog = await getCollection('blog');
  return rss({
    title: 'Data Scientist & Engineer | Turning Complex Problems into Simple, Impactful Solutions',
    description: 'Data Scientist & Engineer | Turning Complex Problems into Simple, Impactful Solutions',
    site: context.site,
    items: blog.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      customData: post.data.customData,
      link: `/posts/${post.slug}/`,
    })),
  });
}
