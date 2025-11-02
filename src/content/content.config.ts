// src/content.config.ts
import { defineCollection, z } from "astro:content";

const pages = defineCollection({
  type: "content",
  schema: ({ image }) =>
    z.object({
      title: z.string().default(""),
      description: z.string().default(""),
      oldUrl: z.string().url().optional(),
      oldPath: z.string().optional(),
      slug: z.string().default(""),
      alias: z.string().optional(),
      images: z.array(z.string()).default([]), // we store optimized paths as strings
      // Optional future field if you want to pick a hero image directly in MD:
      heroImage: image().optional(),
    }),
});

export const collections = { pages };
