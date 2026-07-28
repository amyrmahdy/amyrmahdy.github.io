/**
 * One persistent canvas, fixed behind the DOM, driven entirely by scroll.
 *
 * The canvas is illustration, never content: every word of the narrative lives
 * in the DOM above it, and the SVG/CSS layer underneath is what 100% of
 * visitors get. If this module never loads, the site is already whole.
 */
import * as THREE from "three";
import { onFrame, P } from "../scroll";
import { AdaptiveQuality, QUALITY, type Tier } from "../tier";
import { DEPTH_CURVE, TEMP_CURVE, clamp01, invLerp, lerp, smoothstep } from "./curve";
import { Diamond } from "./Diamond";
import { Lattice } from "./Lattice";
import { Strata } from "./Strata";
import { Streaks } from "./Streaks";

/** 1 world unit = 1 km. Total travel 190 units. */
const MAX_DEPTH = 190;

export class Stage {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;

  // Nested rig: each node has exactly one writer, so scroll never fights
  // parallax and shake cannot corrupt heading.
  private rig = new THREE.Group();   // scroll only
  private yaw = new THREE.Group();   // pointer parallax
  private shake = new THREE.Group(); // velocity-driven noise

  private lattice!: Lattice;
  private strata!: Strata;
  private streaks!: Streaks;
  private diamond!: Diamond;

  private quality!: AdaptiveQuality;
  private settings = QUALITY.MID;
  /** Accumulated from the ticker's own dt rather than THREE.Clock (deprecated,
   *  and redundant here). dt is already clamped, so a long hidden tab cannot
   *  produce a time jump that snaps every animation forward on return. */
  private elapsed = 0;
  private disposed = false;
  private frameAccum = 0;
  private pointer = { x: 0, y: 0 };
  private detach: Array<() => void> = [];

  constructor(private canvas: HTMLCanvasElement, tier: Exclude<Tier, "NONE">) {
    this.settings = QUALITY[tier];
    this.quality = new AdaptiveQuality(tier, (t) => this.applyQuality(QUALITY[t]));

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.settings.msaa > 0,
      alpha: true,
      stencil: false,
      depth: true,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = false; // no shadows anywhere, ever

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 800);
    this.rig.add(this.yaw);
    this.yaw.add(this.shake);
    this.shake.add(this.camera);
    this.scene.add(this.rig);

    this.buildScene();
    this.applyQuality(this.settings);
    this.resize();

    const onResize = this.debouncedResize();
    addEventListener("resize", onResize, { passive: true });
    this.detach.push(() => removeEventListener("resize", onResize));

    const onPointer = (e: PointerEvent) => {
      this.pointer.x = (e.clientX / innerWidth) * 2 - 1;
      this.pointer.y = (e.clientY / innerHeight) * 2 - 1;
    };
    addEventListener("pointermove", onPointer, { passive: true });
    this.detach.push(() => removeEventListener("pointermove", onPointer));

    const onLost = (e: Event) => {
      e.preventDefault();
      // Fade out and let the SVG tier show through — the site stays whole.
      document.documentElement.classList.remove("gl-active");
    };
    canvas.addEventListener("webglcontextlost", onLost);
    this.detach.push(() => canvas.removeEventListener("webglcontextlost", onLost));

    this.detach.push(onFrame((dt) => this.frame(dt)));
  }

  private buildScene() {
    this.strata = new Strata();
    this.scene.add(this.strata.group);

    this.lattice = new Lattice({ atoms: this.settings.atoms });
    this.lattice.group.position.set(0, -MAX_DEPTH, 0);
    this.lattice.group.visible = false;
    this.scene.add(this.lattice.group);

    this.streaks = new Streaks();
    this.streaks.group.visible = false;
    this.scene.add(this.streaks.group);

    // The stone surfaces with the reader: it sits at 0 km, framed for ch7–8.
    this.diamond = new Diamond(this.settings.bounces);
    this.diamond.mesh.position.set(0, 0, -4.2);
    this.diamond.mesh.scale.setScalar(1.6);
    this.scene.add(this.diamond.mesh);

    // Light rig is minimal: almost everything is additive/emissive, because
    // luxury here is low saturation, high contrast, and tiny areas of extreme
    // brightness — not a lit showroom.
    const key = new THREE.PointLight("#ffd9b0", 40, 120, 2);
    key.position.set(6, -MAX_DEPTH + 4, 8);
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight("#20303c", 1.4));
  }

  private applyQuality(s: typeof QUALITY.MID) {
    this.settings = s;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, s.dpr));
    this.resize();
  }

  private debouncedResize() {
    let lastW = innerWidth;
    let lastH = innerHeight;
    let t: number | undefined;
    return () => {
      // iOS browser chrome produces a resize storm mid-scroll; only act on a
      // width change or a height change big enough to be a real rotation.
      if (innerWidth === lastW && Math.abs(innerHeight - lastH) < 120) return;
      lastW = innerWidth;
      lastH = innerHeight;
      clearTimeout(t);
      t = window.setTimeout(() => this.resize(), 120);
    };
  }

  private resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // false: CSS owns the element size, so render scale can drop without
    // touching layout.
    this.renderer.setSize(
      Math.round(w * this.settings.renderScale),
      Math.round(h * this.settings.renderScale),
      false
    );
  }

  private frame(dt: number) {
    if (this.disposed) return;

    // Frame cap for the low tier: skip the draw but keep integrating.
    if (this.settings.fpsCap < 60) {
      this.frameAccum += dt;
      const budget = 1 / this.settings.fpsCap;
      if (this.frameAccum < budget) return;
      this.frameAccum = 0;
    }

    this.elapsed += dt;
    const t = this.elapsed;
    const p = P.smooth;
    const depth = DEPTH_CURVE.at(p);
    const temp = TEMP_CURVE.at(p);

    // Scroll writes the rig, and nothing else does.
    this.rig.position.y = -depth;

    // Pointer parallax, damped so it never feels twitchy.
    this.yaw.rotation.y += (this.pointer.x * 0.12 - this.yaw.rotation.y) * 0.05;
    this.yaw.rotation.x += (this.pointer.y * 0.06 - this.yaw.rotation.x) * 0.05;

    // Ascent: velocity is normalised against the descent's own peak so the
    // eruption reads as fast *relative to the descent the reader just made*.
    const vel = clamp01(Math.abs(P.velocity) / 0.55);
    const ascending = p > 0.72 && p < 0.93;

    if (ascending) {
      const s = 1 - Math.pow(1 - invLerp(0.72, 0.9, clamp01(p)), 3);
      this.camera.fov = lerp(38, 95, s * vel);
      const amp = vel * vel * 0.007; // capped: more reads as broken, not fast
      this.shake.rotation.z = Math.sin(t * 47) * amp;
      this.shake.rotation.x = Math.cos(t * 39) * amp;
    } else {
      this.camera.fov += (38 - this.camera.fov) * 0.08;
      this.shake.rotation.set(0, 0, 0);
    }
    this.camera.updateProjectionMatrix();

    this.strata.update(depth, temp, p);

    // Lattice owns 0.50–0.80: it assembles through the stability field, holds
    // through crystallization, and is still there as the ascent begins.
    const latticeVisible = p > 0.46 && p < 0.86;
    this.lattice.group.visible = latticeVisible;
    if (latticeVisible) {
      const snap = smoothstep(clamp01(invLerp(0.5, 0.7, p)));
      this.lattice.update(snap, t);
    }

    this.streaks.group.visible = ascending;
    if (ascending) this.streaks.update(depth, vel, t);

    // The stone appears as the eruption arrests and stays for the evidence and
    // the ask. After all that speed, it simply sits there — the silence is the
    // payoff, so nothing else is on screen with it.
    this.diamond.update(smoothstep(clamp01(invLerp(0.86, 0.93, p))), t);

    this.renderer.render(this.scene, this.camera);
    this.quality.sample(dt * 1000);
  }

  /** Test seam: drive one frame without rAF. */
  renderOnce() {
    this.frame(1 / 60);
  }

  get debug() {
    return {
      tier: this.quality.tier,
      atoms: this.lattice.atomCount,
      bonds: this.lattice.bondCount,
      facets: this.diamond.facetCount,
      depth: DEPTH_CURVE.at(P.smooth),
      temp: TEMP_CURVE.at(P.smooth),
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
    };
  }

  dispose() {
    this.disposed = true;
    this.detach.forEach((fn) => fn());
    this.lattice.dispose();
    this.strata.dispose();
    this.streaks.dispose();
    this.diamond.dispose();
    this.renderer.dispose();
  }
}
