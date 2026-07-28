# Personal site — build brief for Claude Code

Fill in the four blocks marked **`FILL THIS IN`**, delete the menus you didn't
pick, then paste this whole file to Claude Code inside an empty `<username>.github.io`
repository.

Everything below the placeholders is the spec. It is written from a site that
already shipped, so the constraints and the trap list are real, not theoretical.

---

## 1 · Placeholders — FILL THIS IN

```yaml
NAME:            # e.g. "Sara Nouri"
SHORT_NAME:      # how it appears as a wordmark, e.g. "S. NOURI"
PROFESSION:      # e.g. "Machine Learning Engineer", "Product Designer"
ONE_LINE:        # what you do, in one sentence, aimed at a buyer not a peer
LOCATION:        # e.g. "Berlin, DE"
EMAIL:           # contact address
GITHUB:          # https://github.com/...
REPO_URL:        # https://<username>.github.io
YEARS_ACTIVE:    # e.g. "2018–present"
METAPHOR:        # pick one key from the menu in §2
```

Optional — delete the lines you don't have:

```yaml
WRITING_URL:     # Medium / Substack / personal blog
EXTRA_LINK:      # anything else worth a slot in the footer
```

---

## 2 · Metaphor menu — pick exactly one

The whole site hangs off one transformation: **raw material → instrument →
artifact.** The instrument is the logo. The artifact is the 3D hero object. The
raw material is the particle system it is conjured from.

Pick the row that actually fits the profession. Do not mix two.

| key | instrument (the mark) | raw material | artifact | reads as |
|---|---|---|---|---|
| `carbon` | wand | carbon dust | cut diamond | pressure, patience, value from the ordinary |
| `forge` | hammer & tongs | ore / sparks | folded blade | craft, heat, repetition, edge |
| `optics` | loupe | sand / glass melt | ground lens | clarity, focus, seeing what others can't |
| `signal` | tuning fork | noise particles | clean waveform | extracting order from mess |
| `cartography` | dividers | scattered points | drawn map | making unknown territory navigable |
| `kiln` | potter's rib | wet clay | glazed vessel | shaping, patience, form following use |

**Act structure** — identical for every metaphor, three tricks driven by scroll:

| act | scroll | what happens |
|---|---|---|
| **I — The Reveal** | `0 → 0.35` | instrument rises across frame; raw material is dragged to its working tip; the artifact materialises from nothing |
| **II — The Divide** | `0.35 → 0.70` | instrument dips into a strike/tap; the artifact divides into three |
| **III — The Vanish** | `0.70 → 1.0` | instrument sweeps out of frame; material scatters; one artifact remains |

Per-metaphor palette. `--accent` is the artifact's own light; the warm token is
process heat, never metal — gold reads as wealth, and the site is selling
judgement.

| key | `--accent` | warm token | note |
|---|---|---|---|
| `carbon` | `#eef9fd` ice | `#ff9b50` ember | a cut stone has no colour of its own |
| `forge` | `#ffd9a8` | `#ff6a2b` | quench blues in the artifact only |
| `optics` | `#dff4ff` | `#ffc46b` | prismatic edges once, at the reveal |
| `signal` | `#c9f7ea` | `#ff8a5c` | noise is grey, signal is the only saturated thing |
| `cartography` | `#e8e2d0` | `#c9772f` | parchment white, not blue |
| `kiln` | `#f2e4d4` | `#e2531f` | glaze gloss on the artifact |

---

## 3 · What to build

A three-screen site. **Roughly 140 visible words on the landing page.** Anyone
who has to scroll to find out what you do has already left.

```
/                 3D hero + 3 numbers + 1 email capture      ~140 words
/proof/           index of delivered work
/proof/[slug]     one page per piece of work, each with real numbers
/dossier/         the whole argument flat, printable, 60 seconds
/404              in voice
```

The landing is one fixed WebGL canvas with three scroll acts over it. The other
pages are static HTML with no canvas.

**Non-negotiables**

- The canvas is `position: fixed`. If it lives inside the hero section, acts II
  and III scroll off screen and are never seen. This is the single easiest
  mistake to make here.
- Everything readable works with **zero JavaScript**. The canvas is
  illustration; the DOM carries the meaning. A CSS poster gradient holds the
  frame before first paint and permanently on the static tier.
- No scroll-jacking. Never `preventDefault` on wheel or touch. Smooth the
  *animation's pursuit* of scroll with a damped spring, never the scroll itself.
- `prefers-reduced-motion`, `saveData`, and software-rendered WebGL each mean
  **no canvas is created at all** — not a canvas that then sits still.

---

## 4 · Stack — use these versions

Node **≥ 22.12** (Astro 7 requires it; see trap 1).

```jsonc
"dependencies": {
  "astro": "7.1.3",
  "@astrojs/react": "6.0.1",
  "@astrojs/mdx": "7.0.3",
  "@astrojs/sitemap": "3.7.3",
  "@tailwindcss/vite": "4.3.3",
  "tailwindcss": "4.3.3",
  "react": "19.2.8",
  "react-dom": "19.2.8",
  "three": "0.185.1",
  "@react-three/fiber": "9.6.1",
  "@react-three/drei": "10.7.7",
  "@react-three/postprocessing": "3.0.4"
}
```

**Astro stays as the shell; React mounts as a single island** (`client:load`) for
the scene only. Do not convert the site to a React SPA: the `/proof/*` pages are
the only indexable evidence on the site, and they need static generation, real
`<head>` tags per page, and a print stylesheet.

Tailwind 4 is CSS-first — `@import "tailwindcss"` in the stylesheet, no
`tailwind.config.js`. Register design tokens with `@theme inline` so utilities
emit the live `var(--token)` rather than a frozen copy.

---

## 5 · Design system

**Type — two families, self-hosted, no external requests.**
`Space Grotesk` for display and body, `IBM Plex Mono` for numbers, labels and
eyebrows. Subset to `latin` + `latin-ext` (European names need the diacritics).
Fetch the woff2 files from the Google Fonts CSS API and commit them to
`public/fonts/`. Include metric-matched `@font-face` fallbacks or a 160px
headline will reflow the page on swap.

If the profession is editorial or academic, a serif text face is defensible —
but never a Didone. It reads as old-money institution, not as competence.

**Scale** — fluid `clamp()` from 360→1440px, every step keeping a `rem`
intercept so 200% browser zoom still scales:

```css
--t-micro:    clamp(0.688rem, 0.667rem + 0.093vw, 0.75rem);
--t-small:    clamp(0.813rem, 0.771rem + 0.185vw, 0.938rem);
--t-body:     clamp(1.063rem, 1rem     + 0.278vw, 1.25rem);
--t-h2:       clamp(1.875rem, 1.542rem + 1.481vw, 2.875rem);
--t-monument: clamp(3.75rem,  1.667rem + 9.259vw, 10rem);
```

**Colour** — dark, near-black background, one accent, one warm process token.
**Verify contrast by computing it, not by eyeballing it.** Body text must clear
7:1 against the background. Write a throwaway script that parses the emitted CSS
and prints the ratios; do not trust a table you wrote yourself.

**Layout — three widths.** ~704px reading column (68ch ceiling), ~1040px for
evidence grids, full-bleed for the canvas.

---

## 6 · Content — mock, but honest about it

Generate **6–9 pieces of proof appropriate to `PROFESSION`**. Invent plausible
projects, plausible stacks, plausible numbers. A designer gets design-system
adoption and time-to-first-draft; an ML engineer gets latency and eval pass
rates; a PM gets activation and churn.

Every proof entry carries:

```yaml
title:       # the outcome, not the job title
codename:    # optional, if the thing had a name
org:         # "Confidential" is fine and reads as deliberate
role:
period:
summary:     # <300 chars, doubles as the meta description
metrics:     # 1–4, each { value, label, direction }
method:      # HOW the number was measured — mandatory
stack:
placeholder: true   # see below
```

The `method:` field is the point of the whole page. *"Cut costs 40%"* is
marketing. *"Compared consecutive monthly invoices at equal request volume"* is
proof, and proof is what gets forwarded.

### The honesty guard — implement this, do not skip it

This content is invented, and it is going on a real person's professional site
under their real name. Build the mechanism that stops it shipping silently:

1. Every generated entry gets `placeholder: true` in its frontmatter.
2. The zod schema in `src/content.config.ts` includes `placeholder: z.boolean().default(false)`.
3. `astro.config.mjs` runs a build hook that **prints a loud warning listing
   every file still flagged**, e.g.
   `⚠ 7 proof entries are still placeholders — replace before sharing this URL`.
4. In `dev` only, render a fixed banner on any page showing placeholder data.
5. Write `PLACEHOLDERS.md` at the repo root: a checklist of every invented
   number and where it lives.

The owner replaces the numbers with real ones and flips the flags. Until then
the site is a working template, and it says so to them without saying so to
visitors.

---

## 7 · Traps — these all actually happened

Read these before writing code. Each one cost real debugging time.

1. **Astro 7 needs Node ≥ 22.12, and `prepare: astro sync` runs during
   `npm ci`.** A CI workflow pinned to Node 20 fails at *install*, before the
   build, with a confusing error. Set `node-version: 22` in the GitHub Action,
   and add `engines.node` plus `.nvmrc` so the constraint is visible.

2. **Astro scopes component CSS with a `data-astro-cid-*` attribute, and a
   selector whose *ancestor* lives in a different component will compile fine
   and never match.** If component A writes `[data-state] .thing { }` but
   `[data-state]` is set on an element rendered by component B, Astro emits
   `[cid-A][data-state] .thing` — a condition that element can never satisfy.
   The tell is CSS that is present in the bundle and inert. Keep the state
   attribute on an element the same component owns, or use `:global()`.

3. **The dev server lies. Verify against `dist`.** A scoped `::first-letter`
   rule looked broken for twenty minutes because Vite was serving a stale
   stylesheet; the built output had been correct the whole time. Add a second
   preview target that serves the built folder and check styling there.

4. **`npx serve -s dist` is SPA mode** — it returns `index.html` for every path,
   so all routes look identical and a genuine 404 is invisible. Drop the `-s`.

5. **Automated browsers often run the page backgrounded**, where
   `requestAnimationFrame` is suspended entirely, `innerWidth` can report `0`,
   and scroll events never fire. The scene will appear broken when it is fine.
   Do not chase it. Instead: extract the choreography into a **pure-maths module
   with zero imports** and unit-test it under `node --experimental-strip-types`.
   Assert the gesture is monotone where it should be, that the strike dips and
   returns, and that the largest per-scroll-step move is small enough that there
   are no visual jumps. Then say plainly that the *look* is unverified.

6. **Reading a computed style immediately after changing a class returns the
   pre-transition value.** Disable transitions in the test, or you will
   "discover" a bug that does not exist.

7. **`MeshTransmissionMaterial` renders its own transmission buffer per
   instance.** Three of them is three extra full passes per frame. Use it for
   the hero artifact only; give the act-II duplicates a cheap iridescent
   `meshPhysicalMaterial` — at that size and speed nobody reads the difference.

8. **Dispersion is invisible against a soft environment**, which averages the
   colour channels back together. Build the environment from a few small, very
   bright `<Lightformer>`s inside `<Environment>` — that also means no HDR file
   to fetch, so the site keeps zero external requests.

9. **Commit `.gitignore` before anything else.** Check `git ls-files | wc -l`
   early; if `node_modules` is in there, fix it before adding three.js.

---

## 8 · Verification — required before you call it done

Run all of these and report the actual numbers, not adjectives.

- `npm ci && npm run build` from a **clean clone**, on **Node 22**. This is what
  CI runs; a local success on a different Node proves nothing.
- Serve `dist/` (no `-s`) and confirm every route returns its own distinct
  document, and that an unknown path 404s.
- Landing page word count ≤ ~160 visible words.
- **Zero horizontal overflow** at 1440px, 1093px (a 1366×768 laptop at 125% OS
  zoom — the most representative enterprise viewport) and 390px.
- Contrast ratios computed from the emitted CSS, printed, all body text ≥ 7:1.
- With `prefers-reduced-motion: reduce`, confirm via the network panel that
  **three.js is never fetched at all** and the page still reads completely.
- No console errors on any page.
- Report the gzipped weight of: the HTML, the CSS, and each JS chunk.

**Expect roughly 330 KB gz of JavaScript.** That is what R3F plus drei plus
three costs for 3D on arrival, and it is a real trade. Nothing should block
first paint: the HTML and CSS render immediately and the canvas fades in.

---

## 9 · Definition of done

- Three acts visible across the scroll; the canvas is fixed and never scrolls away.
- The instrument is the favicon and the wordmark.
- Every proof page has a `method:` note.
- `PLACEHOLDERS.md` lists every invented number.
- The build prints its placeholder warning.
- Deployed to GitHub Pages via Actions on push to `main`.
- The person's name, profession and one-line pitch are visible without scrolling.

---

## 10 · Tone

Minimal, professional, futuristic. Short sentences. No adjectives doing work
that a number should do.

The metaphor earns its place only where it makes an argument prose cannot — one
counterintuitive, verifiable claim. In the carbon build, that claim was *a slow
ascent turns a diamond back into graphite, so speed is what preserves value.*
Find the equivalent for the chosen metaphor, state it **once**, and then let the
geometry carry it.

**Never apply the metaphor as an adjective to the person.** No "diamond-grade",
no "razor-sharp", no "crystal-clear". The site teaches the physics and lets the
reader do the arithmetic. A claim about the material is credible; the same claim
about the person is not.
