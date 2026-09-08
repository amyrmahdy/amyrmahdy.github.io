#!/usr/bin/env node
/**
 * Checks the BUILT output, not the source. The dev server has served stale
 * stylesheets before; dist is the artefact that ships.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
let fail = 0;
const ok = (label, cond, detail = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "  ok  " : " FAIL "} ${label}${detail ? "  " + detail : ""}`);
};
const read = (p) => readFileSync(join(DIST, p), "utf8");
const strip = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ");
const words = (html) => strip(html).split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
const walk = (d, out = []) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};

console.log("\nLANDING");
const index = read("index.html");
const visible = strip(index);
ok("visible words ≤ 160", words(index) <= 160, `${words(index)} words`);
const h1 = index.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, "").trim();
ok("h1", h1 === "Everyone is already seated.", JSON.stringify(h1));
for (const w of ["conductor", "orchestra", "maestro", "virtuoso", "baton", "podium", "symphony", "diamond", "carbon"]) {
  ok(`no "${w}" in visible copy`, !new RegExp(`\\b${w}\\b`, "i").test(visible));
}
ok("no LinkedIn", !/linkedin/i.test(index));
ok("no VASL", !/\bVASL\b/.test(index));
ok("exactly one email input", (index.match(/type="email"/g) || []).length === 1);
ok("three proof entries", (index.match(/data-third="\d"/g) || []).length === 3);
ok("canvas island present", /astro-island/.test(index));

console.log("\nCSS (dist)");
const css = walk(join(DIST, "_astro")).filter((f) => f.endsWith(".css")).map((f) => readFileSync(f, "utf8")).join("\n");
for (const sel of ['html[data-mv="2"]', 'html[data-mv="3"]', "html.baton-live", 'html[data-cue="3"]', ".sound[aria-pressed"]) {
  ok(`selector ${sel}`, css.includes(sel));
}
ok("no data-ch chapter states remain", !/data-ch=/.test(css));

console.log("\nNO SCROLL-JACK / NO ASSETS");
const js = walk(join(DIST, "_astro")).filter((f) => f.endsWith(".js"));
const scene = js.filter((f) => /Scene/.test(f)).map((f) => readFileSync(f, "utf8")).join("\n");
for (const s of ['"wheel"', '"touchmove"', "scroll-snap", "scroll-behavior:smooth"]) {
  ok(`scene chunk has no ${s}`, !scene.includes(s));
}
// R3F's event wrappers carry preventDefault for canvas pointer events (the
// canvas is pointer-events:none, so they never fire); the real scroll-jack
// test is the wheel/touchmove absence above plus OUR source having none.
{
  // WaitlistForm's submit handler legitimately prevents the form's own
  // navigation; the scene, the libs and the landing page must have none.
  const srcFiles = walk(new URL("../src/", import.meta.url).pathname)
    .filter((f) => /\.(ts|tsx|astro)$/.test(f))
    .filter((f) => /\/(components\/scene|lib)\/|\/pages\/index\.astro$/.test(f));
  const offenders = srcFiles.filter((f) => /\.preventDefault\(/.test(readFileSync(f, "utf8")));
  ok("no preventDefault in scene/lib/landing source", offenders.length === 0, offenders.map((f) => f.split("/src/")[1]).join(", "));
}
ok("no HDR/audio assets referenced", !walk(DIST).some((f) => /\.(hdr|exr|mp3|wav|ogg)$/i.test(f)));
ok("no MeshTransmissionMaterial", !/MeshTransmissionMaterial/.test(scene));

console.log("\nBUDGET");
let total = 0;
for (const f of js) {
  const gz = gzipSync(readFileSync(f)).length;
  total += gz;
  console.log(`        ${String(gz).padStart(7)} B gz  ${f.split("/").pop().slice(0, 44)}`);
}
ok("total JS ≤ 360 KB gz", total <= 368640, `${total} B`);

console.log("\nPROOF");
const proof = read("proof/index.html");
const ph1 = proof.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, "").trim();
ok("proof h1", ph1 === "Every number carries its method.", JSON.stringify(ph1));
for (const w of ["carat", "stone", "diamond", "descent"]) ok(`proof has no "${w}"`, !new RegExp(`\\b${w}\\b`, "i").test(strip(proof)));

console.log("\nMARK");
const fav = readFileSync(new URL("../public/favicon.svg", import.meta.url), "utf8");
ok("favicon viewBox", /viewBox="0 0 100 100"/.test(fav));
ok("favicon shaft", /points="29,71 33,67 85.4,13.4 86,14"/.test(fav));
ok("favicon bulb", /<ellipse cx="23" cy="77" rx="6" ry="9"/.test(fav));
for (const f of ["default", "proof", "dossier"]) {
  const p = new URL(`../public/og/${f}.png`, import.meta.url).pathname;
  let dims = null;
  if (existsSync(p)) {
    const b = readFileSync(p);
    dims = [b.readUInt32BE(16), b.readUInt32BE(20)];
  }
  ok(`og/${f}.png is 1200×630`, dims && dims[0] === 1200 && dims[1] === 630, dims ? dims.join("×") : "missing");
}

console.log(fail ? `\n${fail} FAILURE(S)\n` : "\nall passed\n");
process.exit(fail ? 1 : 0);
