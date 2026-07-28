/** Chronology, shared by the dossier and the descent chapters. */

export interface Post {
  period: string;
  role: string;
  org: string;
  place: string;
  /** Which chapter of the descent carries this beat. */
  chapter: number;
}

export const CAREER: Post[] = [
  {
    period: "2025–present",
    role: "Chief Technology Officer & AI Consultant",
    org: "Smartway Solutions",
    place: "Germany",
    chapter: 6,
  },
  {
    period: "2024–2025",
    role: "Lead Forward Deployed Engineer & Product Architect",
    org: "Mistix AI",
    place: "Dubai, UAE",
    chapter: 4,
  },
  {
    period: "2023–2024",
    role: "Head of AI",
    org: "Confidential",
    place: "Remote",
    chapter: 3,
  },
  {
    period: "2022–2023",
    role: "AI Engineer",
    org: "Confidential",
    place: "Remote",
    chapter: 3,
  },
  {
    period: "2019–2022",
    role: "Data Scientist, freelance",
    org: "Self-employed",
    place: "Remote",
    chapter: 2,
  },
];

export const EDUCATION = [
  {
    period: "2022",
    award: "M.Sc. Applied Mathematics & Informatics",
    org: "Astrakhan State University",
    place: "Russia",
    note: "GPA 4.62 / 5.0",
  },
  {
    period: "2019",
    award: "B.Sc. Computer Science",
    org: "Mahalat Higher Educational Institution",
    place: "Iran",
    note: "",
  },
];

/** The Harvest Methodology, as referenced across the site. */
export const HARVEST_LOOP = [
  "Bet",
  "Deploy",
  "Deliver",
  "Evaluate",
  "Harvest",
  "Reuse",
] as const;

export const HARVEST_PILLARS = [
  {
    name: "Architect First",
    statement:
      "Structure, interfaces, and system design determine speed, quality, and reuse — before a line ships.",
  },
  {
    name: "Deliver First",
    statement:
      "Working value fast over endless planning, focusing on the 20% of work that creates 80% of the impact.",
  },
  {
    name: "Harvestable by Design",
    statement:
      "Every delivery extracts reusable IP — prompts, patterns, assets — into a compounding organizational backbone.",
  },
] as const;

export const HARVEST_TERMS = [
  { term: "ICE", def: "Impact, Confidence, Ease. How a bet is selected, so the argument is about the score rather than about who spoke last." },
  { term: "Deployment Pod", def: "A small, customer-proximate team with one owner and a rapid feedback loop. The unit of delivery." },
  { term: "Backbone", def: "The long-term store of reusable IP every delivery contributes to. What makes the second engagement cheaper than the first." },
  { term: "Minimum Quality Floor", def: "The bar below which nothing ships, however urgent. What makes speed survivable rather than reckless." },
  { term: "MLP", def: "Minimum Lovable Product. The standard the floor is set against — usable and worth using, not merely viable." },
] as const;
