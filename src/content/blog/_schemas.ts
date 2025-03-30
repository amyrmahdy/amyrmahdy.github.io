import { z } from "astro:content";

export const blogSchema = z
  .object({
    pubDate: z.date(),
    title: z.string(),
    tags: z.array(z.string()).default(["others"]),
    categories: z.array(z.string()).default(["others"]),
    author: z.string().optional().default("Alasdair Brown"),
    description: z.string().optional().default("Yes"),
    ogImage: z.string().optional(),
    postSlug: z.string().optional(),
    featured: z.boolean().optional(),
    draft: z.boolean().optional(),
  })
  .strict();

export type BlogFrontmatter = z.infer<typeof blogSchema>;
