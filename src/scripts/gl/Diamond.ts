/**
 * The cut stone. Chapters 7–8.
 *
 * Not MeshPhysicalMaterial. Three's `transmission` refracts the opaque scene
 * behind the object exactly once — no total internal reflection, no multi-
 * bounce — and diamond's entire visual identity comes from light entering the
 * crown and bouncing twice off the pavilion via TIR (critical angle 24.4°).
 * The physical material gives a glass paperweight, and costs a second full
 * scene render plus a per-frame mipmap chain to do it.
 *
 * A round brilliant is convex, so the interior can be raytraced exactly in the
 * fragment shader with a flat plane loop: no BVH, no extra scene pass, and
 * real dispersion for free by running the trace at three measured indices.
 */
import * as THREE from "three";

/** Measured refractive indices of diamond. n_F - n_C = 0.044, the highest
 *  dispersion of any common gemstone — that difference *is* the fire. */
const IOR_R = 2.4099; // 656nm
const IOR_G = 2.4175; // 589nm — the "2.417" everyone quotes
const IOR_B = 2.4327; // 486nm

/** Real grading proportions, girdle diameter = 1. Made-up proportions read as
 *  programmer art instantly, even to people who could not say why. */
const TABLE = 0.56;
const CROWN_H = 0.145;
const GIRDLE_H = 0.03;
const PAV_H = 0.431;

export class Diamond {
  readonly mesh: THREE.Mesh;
  private uniforms: Record<string, THREE.IUniform>;

  constructor(bounces: number) {
    const geo = this.buildBrilliant();
    const planes = this.extractPlanes(geo);

    // Facet planes live in a DataTexture rather than a uniform array, which
    // sidesteps GL_MAX_FRAGMENT_UNIFORM_VECTORS entirely on weaker drivers.
    const data = new Float32Array(64 * 4);
    planes.forEach((p, i) => {
      if (i >= 64) return;
      data[i * 4] = p.normal.x;
      data[i * 4 + 1] = p.normal.y;
      data[i * 4 + 2] = p.normal.z;
      data[i * 4 + 3] = p.constant;
    });
    const planeTex = new THREE.DataTexture(
      data,
      64,
      1,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    planeTex.magFilter = planeTex.minFilter = THREE.NearestFilter;
    planeTex.needsUpdate = true;

    this.uniforms = {
      uPlanes: { value: planeTex },
      uPlaneCount: { value: Math.min(planes.length, 64) },
      uEnv: { value: null },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uCrystal: { value: 1 },
      uIce: { value: new THREE.Color("#eef9fd") },
      uEmber: { value: new THREE.Color("#ff9b50") },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      side: THREE.FrontSide,
      vertexShader: /* glsl */ `
        varying vec3 vNormalW;
        varying vec3 vPosL;
        varying vec3 vViewW;
        void main() {
          vPosL = position;
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vec4 world = modelMatrix * vec4(position, 1.0);
          vViewW = normalize(world.xyz - cameraPosition);
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uPlanes;
        uniform int  uPlaneCount;
        uniform float uTime;
        uniform float uReveal;
        uniform float uCrystal;
        uniform vec3 uIce;
        uniform vec3 uEmber;
        varying vec3 vNormalW;
        varying vec3 vPosL;
        varying vec3 vViewW;

        const int MAX_PLANES = 64;
        const int BOUNCES = ${Math.max(1, Math.min(4, bounces))};

        // Nearest positive-facing plane: the exact exit point for a convex solid.
        void exitFace(vec3 o, vec3 dir, out float t, out vec3 n) {
          t = 1e9; n = vec3(0.0, 1.0, 0.0);
          for (int i = 0; i < MAX_PLANES; i++) {
            if (i >= uPlaneCount) break;
            vec4 P = texelFetch(uPlanes, ivec2(i, 0), 0);
            float den = dot(dir, P.xyz);
            if (den > 1e-6) {
              float ti = (P.w - dot(o, P.xyz)) / den;
              if (ti > 1e-5 && ti < t) { t = ti; n = P.xyz; }
            }
          }
        }

        // Stand-in environment: a dark studio with a few small, very bright
        // sources. Dispersion is only visible against sharp highlights — a big
        // soft HDRI averages the three channels back together and the fire dies.
        vec3 envSample(vec3 d) {
          float key  = pow(max(dot(d, normalize(vec3( 0.5,  0.8,  0.35))), 0.0), 48.0);
          float rim  = pow(max(dot(d, normalize(vec3(-0.7,  0.25, -0.5 ))), 0.0), 30.0);
          float fill = pow(max(dot(d, normalize(vec3( 0.1, -0.9,  0.2  ))), 0.0), 16.0);
          vec3 c = uIce * key * 7.0 + uIce * rim * 3.0 + uEmber * fill * 1.2;
          c += mix(vec3(0.012, 0.016, 0.022), vec3(0.05, 0.06, 0.08),
                   smoothstep(-1.0, 1.0, d.y)) * 0.7;
          return c;
        }

        // One channel's path through the stone, including TIR.
        float traceChannel(vec3 o, vec3 dir, vec3 nrm, float eta, out vec3 outDir) {
          vec3 r = refract(dir, nrm, eta);
          if (dot(r, r) < 1e-6) { outDir = reflect(dir, nrm); return 1.0; }
          vec3 pos = o;
          for (int b = 0; b < BOUNCES; b++) {
            float t; vec3 n;
            exitFace(pos, r, t, n);
            pos += r * t;
            vec3 refracted = refract(r, -n, 1.0 / eta);
            if (dot(refracted, refracted) < 1e-6) {
              r = reflect(r, -n);   // total internal reflection — the brilliance
              continue;
            }
            outDir = refracted;
            return 0.0;
          }
          outDir = r;
          return 0.0;
        }

        void main() {
          vec3 nrm = normalize(vNormalW);
          vec3 dir = normalize(vViewW);

          vec3 dR, dG, dB;
          traceChannel(vPosL, dir, nrm, 1.0 / ${IOR_R.toFixed(4)}, dR);
          traceChannel(vPosL, dir, nrm, 1.0 / ${IOR_G.toFixed(4)}, dG);
          traceChannel(vPosL, dir, nrm, 1.0 / ${IOR_B.toFixed(4)}, dB);

          vec3 inner = vec3(envSample(dR).r, envSample(dG).g, envSample(dB).b);

          // Schlick at diamond's real F0 = ((2.417-1)/(2.417+1))^2 = 0.172,
          // which is extremely high and precisely why it looks so hard.
          float f0 = 0.172;
          float fres = f0 + (1.0 - f0) * pow(1.0 - max(dot(-dir, nrm), 0.0), 5.0);
          vec3 spec = envSample(reflect(dir, nrm)) * fres * 1.4;

          vec3 col = inner * (1.0 - fres) + spec;

          // Reverted carbon is graphite: opaque, grey, and it absorbs rather
          // than returns light. Desaturate toward luminance and crush the
          // brightness as crystallinity falls — the fire is the first thing to
          // go, which is exactly the point being made.
          float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
          vec3 graphite = vec3(lum) * 0.16 + vec3(0.035, 0.036, 0.040);
          col = mix(graphite, col, uCrystal);

          float alpha = uReveal * mix(0.94, 1.0, uCrystal);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** Round brilliant by revolution: table, crown, girdle, pavilion to a culet. */
  private buildBrilliant(): THREE.BufferGeometry {
    const seg = 16;
    const rGirdle = 1;
    const rTable = TABLE;
    const yTable = CROWN_H + GIRDLE_H / 2;
    const yGirdleTop = GIRDLE_H / 2;
    const yGirdleBot = -GIRDLE_H / 2;
    const yCulet = -(PAV_H + GIRDLE_H / 2);

    const pos: number[] = [];
    const ring = (r: number, y: number) =>
      Array.from({ length: seg }, (_, i) => {
        const a = (i / seg) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
      });

    const table = ring(rTable, yTable);
    const gTop = ring(rGirdle, yGirdleTop);
    const gBot = ring(rGirdle, yGirdleBot);
    const culet = new THREE.Vector3(0, yCulet, 0);
    const centre = new THREE.Vector3(0, yTable, 0);

    const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);

    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      tri(centre, table[i], table[j]);           // table
      tri(table[i], gTop[i], gTop[j]);           // crown
      tri(table[i], gTop[j], table[j]);
      tri(gTop[i], gBot[i], gBot[j]);            // girdle
      tri(gTop[i], gBot[j], gTop[j]);
      tri(gBot[i], culet, gBot[j]);              // pavilion
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    return geo;
  }

  /** Dedupe triangle planes into the unique facet set the tracer walks. */
  private extractPlanes(geo: THREE.BufferGeometry): THREE.Plane[] {
    const p = geo.getAttribute("position");
    const out: THREE.Plane[] = [];
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const plane = new THREE.Plane();

    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i);
      b.fromBufferAttribute(p, i + 1);
      c.fromBufferAttribute(p, i + 2);
      plane.setFromCoplanarPoints(a, b, c);
      if (plane.normal.lengthSq() < 0.5) continue;
      const dup = out.some(
        (q) =>
          q.normal.dot(plane.normal) > 0.9995 &&
          Math.abs(q.constant - plane.constant) < 1e-3
      );
      if (!dup) out.push(plane.clone());
    }
    return out;
  }

  get facetCount() {
    return this.uniforms.uPlaneCount.value as number;
  }

  update(reveal: number, t: number, crystallinity = 1) {
    this.uniforms.uReveal.value = reveal;
    this.uniforms.uTime.value = t;
    this.uniforms.uCrystal.value = crystallinity;
    this.mesh.visible = reveal > 0.01;
    // A reverted stone turns more sluggishly — graphite is soft, not brilliant.
    this.mesh.rotation.y = t * (0.06 + 0.12 * crystallinity);
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    (this.uniforms.uPlanes.value as THREE.DataTexture).dispose();
  }
}
