import { defineCollection, z } from "astro:content";
import { glob, file } from "astro/loaders";

/**
 * Deliberately not a CMS. Body content becomes a collection; pure metadata gets
 * the file() loader; short fixed lists welded to bespoke layout stay hardcoded
 * in their components.
 */

const STAGES = ["surface", "descent", "pressure", "crystallization", "ascent"] as const;

/**
 * Case studies. These carry the numbers that currently exist only in the CV and
 * are invisible to search — "85% faster multi-agent soil classification" is a
 * page that can rank and that can be pasted into a proposal.
 */
const proof = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/proof" }),
  schema: z.object({
    title: z.string(),
    /** Named system, where one exists: "Oasis", "Cortex-Axon-Synapse". */
    codename: z.string().optional(),
    org: z.enum(["Smartway Solutions", "Mistix AI", "Confidential", "Freelance"]),
    role: z.string(),
    period: z.string(),
    /** Doubles as the meta description. */
    summary: z.string().max(300),
    metrics: z
      .array(
        z.object({
          value: z.string(),
          label: z.string(),
          /** Direction of the good outcome, for the arrow glyph. */
          direction: z.enum(["up", "down", "flat"]).default("up"),
        })
      )
      .min(1)
      .max(4),
    /** How the number was measured. A claim without this is marketing. */
    method: z.string(),
    stack: z.array(z.string()).default([]),
    /** Which Harvest principle this delivery demonstrates. */
    principle: z.enum([
      "Architect First",
      "Deliver First",
      "Harvestable by Design",
    ]),
    /** Guards against naming a client by accident. */
    clientNamed: z.boolean().default(false),
    featured: z.boolean().default(false),
    order: z.number().int(),
  }),
});

/**
 * Ten Medium links with no body. Ten stub files with empty bodies would be the
 * over-engineering trap; one typed JSON file gets zod validation without them.
 */
const essays = defineCollection({
  loader: file("./src/data/essays.json"),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    date: z.coerce.date(),
    url: z.string().url(),
    flagship: z.boolean().default(false),
    topic: z
      .enum(["methodology", "org-design", "agents", "evals", "hiring"])
      .optional(),
  }),
});

/**
 * Book chapter teasers. Front-matter is the entire payload — there is no body
 * field, so a manuscript draft cannot accidentally land in the public repo.
 * Teasers are written as marketing copy and pasted in by hand from the private
 * harvest-book repo; no automation crosses that boundary.
 */
const book = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/book" }),
  schema: z.object({
    order: z.number().int(),
    part: z.enum(STAGES),
    title: z.string(),
    teaser: z.string().max(400),
    pullQuote: z.string().max(200).optional(),
    status: z
      .enum(["outlined", "drafting", "drafted", "edited"])
      .default("outlined"),
    published: z.boolean().default(false),
  }),
});

export const collections = { proof, essays, book };
