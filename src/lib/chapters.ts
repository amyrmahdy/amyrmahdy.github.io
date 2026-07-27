/**
 * The chapter spine. Single source of truth for the depth rail, the chapter
 * sections, and later the WebGL camera curve — so telemetry can never drift
 * between what the rail says and what the scene renders.
 *
 * Depth figures are real: diamonds form 150–200 km down at ~1150 °C and ~5.4 GPa
 * (roughly 53,000× surface pressure), and reach the surface via kimberlite
 * eruption in hours. A slow ascent turns diamond back into graphite.
 */

export type Stage =
  | "surface"
  | "descent"
  | "pressure"
  | "crystallization"
  | "ascent";

export interface Chapter {
  /** 1-indexed; drives `html[data-ch]` and the palette state. */
  n: number;
  id: string;
  stage: Stage;
  /** Display title — the argument, not a label. */
  title: string;
  /** Mono kicker shown in the rail. */
  kicker: string;
  /** Depth in km at the chapter's start and end. */
  km: [number, number];
  /** Temperature in °C. */
  celsius: [number, number];
  /** Pressure, pre-formatted for display. */
  pressure: string;
  /** Normalised scroll progress range this chapter owns, 0–1. */
  p: [number, number];
}

export const CHAPTERS: Chapter[] = [
  {
    n: 1,
    id: "prep",
    stage: "surface",
    title: "Same carbon.",
    kicker: "PREP",
    km: [0, 0],
    celsius: [20, 20],
    pressure: "1 atm",
    p: [0.0, 0.06],
  },
  {
    n: 2,
    id: "crust",
    stage: "descent",
    title: "Nobody skips the crust.",
    kicker: "CRUST",
    km: [0, 35],
    celsius: [20, 600],
    pressure: "1 GPa",
    p: [0.06, 0.3],
  },
  {
    n: 3,
    id: "mantle",
    stage: "descent",
    title: "Heat without structure just destroys things.",
    kicker: "MANTLE",
    km: [35, 140],
    celsius: [600, 1000],
    pressure: "4.5 GPa",
    p: [0.3, 0.5],
  },
  {
    n: 4,
    id: "stability",
    stage: "pressure",
    title: "Nothing above this line survives.",
    kicker: "STABILITY FIELD",
    km: [140, 190],
    celsius: [1000, 1150],
    pressure: "5.4 GPa",
    p: [0.5, 0.62],
  },
  {
    n: 5,
    id: "lattice",
    stage: "crystallization",
    title: "A method is what you use instead of time.",
    kicker: "LATTICE",
    km: [190, 190],
    celsius: [1150, 1150],
    pressure: "5.4 GPa",
    p: [0.62, 0.72],
  },
  {
    n: 6,
    id: "ascent",
    stage: "ascent",
    title: "A slow ascent turns it back into graphite.",
    kicker: "KIMBERLITE",
    km: [190, 0],
    celsius: [1150, 20],
    pressure: "releasing",
    p: [0.72, 0.9],
  },
  {
    n: 7,
    id: "cut",
    stage: "surface",
    title: "The cut decides, not the carat.",
    kicker: "THE CUT",
    km: [0, 0],
    celsius: [20, 20],
    pressure: "1 atm",
    p: [0.9, 0.96],
  },
  {
    n: 8,
    id: "landing",
    stage: "surface",
    title: "What comes out.",
    kicker: "LANDING",
    km: [0, 0],
    celsius: [20, 20],
    pressure: "1 atm",
    p: [0.96, 1.0],
  },
];

export const byId = (id: string) => CHAPTERS.find((c) => c.id === id)!;

/** Deepest point reached, for the rail's scale. */
export const MAX_KM = 190;
