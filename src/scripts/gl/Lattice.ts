/**
 * The crystallization moment: carbon in chaos snapping into the diamond cubic
 * lattice.
 *
 * Deliberately a deterministic analytic morph, not a GPU particle simulation.
 * A physics sim is stateful and therefore not scroll-reversible — scrubbing
 * backwards would produce different results than scrubbing forwards, which
 * reads as a bug. Everything here is a pure function of scroll progress.
 */
import * as THREE from "three";
import { clamp01 } from "./curve";

/** Real diamond lattice constant, in ångström. */
const A = 3.567;
/** FCC + a second basis offset by (¼,¼,¼) — this is what makes it *diamond*
 *  cubic rather than plain face-centred cubic. Bond angle falls out at 109.47°. */
const BASIS = [
  [0, 0, 0],
  [0, 0.5, 0.5],
  [0.5, 0, 0.5],
  [0.5, 0.5, 0],
  [0.25, 0.25, 0.25],
  [0.25, 0.75, 0.75],
  [0.75, 0.25, 0.75],
  [0.75, 0.75, 0.25],
];
const BOND = (A * Math.sqrt(3)) / 4; // 1.5445 Å

export interface LatticeOptions {
  /** Target atom count; the octahedral clip means actual count comes in under. */
  atoms: number;
}

interface Bond {
  a: number;
  b: number;
}

export class Lattice {
  readonly group = new THREE.Group();
  private atomMesh!: THREE.InstancedMesh;
  private bondMesh!: THREE.InstancedMesh;
  private positions: THREE.Vector3[] = [];
  private bonds: Bond[] = [];
  private dummy = new THREE.Object3D();
  private atomUniforms!: { uSnap: { value: number }; uTime: { value: number } };
  private bondUniforms!: { uGrow: { value: number } };

  constructor(opts: LatticeOptions) {
    this.build(opts.atoms);
  }

  /** Diamond's natural growth habit is the octahedron, so the cluster is
   *  clipped to |x|+|y|+|z| <= R rather than to a cube. This is physically
   *  right and it sets up rough-octahedron -> cut-brilliant later. */
  private generateSites(target: number): THREE.Vector3[] {
    // An octahedron keeps well under half the cube it is inscribed in, so
    // sizing the cell block from the target directly undershoots badly. Grow
    // the block until the clipped cluster actually reaches the target.
    for (let n = 3; n <= 14; n++) {
      const half = (n * A) / 2;
      const R = half * 1.12;
      const kept: THREE.Vector3[] = [];

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          for (let k = 0; k < n; k++) {
            for (const b of BASIS) {
              const x = (i + b[0]) * A - half;
              const y = (j + b[1]) * A - half;
              const z = (k + b[2]) * A - half;
              if (Math.abs(x) + Math.abs(y) + Math.abs(z) <= R) {
                kept.push(new THREE.Vector3(x, y, z));
              }
            }
          }
        }
      }

      if (kept.length >= target || n === 14) {
        // Nearest the nucleation centre first, so truncating to the target
        // keeps a solid core rather than a shell with holes in it.
        kept.sort((p, q) => p.lengthSq() - q.lengthSq());
        return kept.slice(0, target);
      }
    }
    return [];
  }

  /** Uniform spatial hash: cell size = bond length, 27-neighbour scan, i<j to
   *  dedupe. O(n) rather than the O(n²) pair loop. */
  private findBonds(sites: THREE.Vector3[]): Bond[] {
    const cell = BOND * 1.15;
    const grid = new Map<string, number[]>();
    const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

    sites.forEach((v, i) => {
      const k = key(
        Math.floor(v.x / cell),
        Math.floor(v.y / cell),
        Math.floor(v.z / cell)
      );
      const arr = grid.get(k);
      if (arr) arr.push(i);
      else grid.set(k, [i]);
    });

    const out: Bond[] = [];
    const maxSq = (BOND * 1.12) ** 2;

    sites.forEach((v, i) => {
      const cx = Math.floor(v.x / cell);
      const cy = Math.floor(v.y / cell);
      const cz = Math.floor(v.z / cell);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const arr = grid.get(key(cx + dx, cy + dy, cz + dz));
            if (!arr) continue;
            for (const j of arr) {
              if (j <= i) continue;
              if (v.distanceToSquared(sites[j]) <= maxSq) out.push({ a: i, b: j });
            }
          }
        }
      }
    });

    return out;
  }

  private build(target: number) {
    const sites = this.generateSites(target);
    this.positions = sites;
    this.bonds = this.findBonds(sites);

    const count = sites.length;
    const scale = 0.42; // world units per ångström, tuned to frame the cluster

    // ── atoms ──────────────────────────────────────────────────────────────
    const geo = new THREE.IcosahedronGeometry(0.16, 1);
    const chaos = new Float32Array(count * 3);
    const lattice = new Float32Array(count * 3);
    const delay = new Float32Array(count);
    const seed = new Float32Array(count);

    // Nucleation: atoms nearest the seed point land first and growth propagates
    // outward, so the crystal appears to grow rather than teleport into place.
    const maxDist = Math.max(...sites.map((s) => s.length()));

    sites.forEach((s, i) => {
      // Golden-angle spiral in a sphere — an even chaotic distribution with no
      // clumping, and it ties back to the Fibonacci motif.
      const t = i / count;
      const phi = Math.acos(1 - 2 * t);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = 3.4 + 1.6 * Math.sin(i * 12.9898);
      chaos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      chaos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      chaos[i * 3 + 2] = r * Math.cos(phi);

      lattice[i * 3] = s.x * scale;
      lattice[i * 3 + 1] = s.y * scale;
      lattice[i * 3 + 2] = s.z * scale;

      delay[i] = (s.length() / maxDist) * 0.55;
      seed[i] = (Math.sin(i * 78.233) * 43758.5453) % 1;
    });

    geo.setAttribute("aChaos", new THREE.InstancedBufferAttribute(chaos, 3));
    geo.setAttribute("aLattice", new THREE.InstancedBufferAttribute(lattice, 3));
    geo.setAttribute("aDelay", new THREE.InstancedBufferAttribute(delay, 1));
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));

    this.atomUniforms = { uSnap: { value: 0 }, uTime: { value: 0 } };

    const atomMat = new THREE.ShaderMaterial({
      uniforms: {
        ...this.atomUniforms,
        uColor: { value: new THREE.Color("#eef9fd") },
        uEmber: { value: new THREE.Color("#ff9b50") },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aChaos;
        attribute vec3 aLattice;
        attribute float aDelay;
        attribute float aSeed;
        uniform float uSnap;
        uniform float uTime;
        varying float vFlash;
        varying float vSettled;

        // Cheap curl-ish turbulence; only needs to look unsettled, not be exact.
        vec3 turb(vec3 p, float s) {
          return vec3(
            sin(p.y * 1.3 + uTime * 0.7 + s * 6.28),
            cos(p.z * 1.1 + uTime * 0.6 + s * 4.19),
            sin(p.x * 1.7 + uTime * 0.5 + s * 2.71)
          ) * 0.5;
        }

        // The overshoot is the difference between "snap" and "drift".
        float easeOutBack(float t) {
          float c1 = 1.9;
          float c3 = c1 + 1.0;
          float f = t - 1.0;
          return 1.0 + c3 * f * f * f + c1 * f * f;
        }

        void main() {
          float t = clamp((uSnap - aDelay) / 0.35, 0.0, 1.0);
          float e = easeOutBack(t);
          vec3 chaos = aChaos + turb(aChaos, aSeed) * (1.0 - t);
          vec3 pos = mix(chaos, aLattice, e);

          vFlash = exp(-12.0 * abs(t - 1.0));
          vSettled = t;

          vec3 transformed = position * mix(0.75, 1.0, t) + pos;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform vec3 uEmber;
        varying float vFlash;
        varying float vSettled;
        void main() {
          vec3 c = mix(uEmber, uColor, vSettled);
          float a = 0.28 + 0.72 * vSettled + vFlash * 0.9;
          gl_FragColor = vec4(c * (0.9 + vFlash * 1.6), a);
        }
      `,
    });

    this.atomMesh = new THREE.InstancedMesh(geo, atomMat, count);
    this.atomMesh.frustumCulled = false;
    this.group.add(this.atomMesh);

    // ── bonds ──────────────────────────────────────────────────────────────
    // Rest transforms computed once on the CPU; animation is entirely uniform-
    // driven, so there is no per-frame CPU work here at all.
    const bondGeo = new THREE.CylinderGeometry(0.028, 0.028, 1, 6, 1, true);
    const bondCount = this.bonds.length;
    const bondDelay = new Float32Array(bondCount);

    this.bondUniforms = { uGrow: { value: 0 } };
    const bondMat = new THREE.ShaderMaterial({
      uniforms: {
        ...this.bondUniforms,
        uColor: { value: new THREE.Color("#eef9fd") },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aBondDelay;
        uniform float uGrow;
        varying float vAlpha;
        void main() {
          float t = clamp((uGrow - aBondDelay) / 0.3, 0.0, 1.0);
          vAlpha = t;
          vec3 p = position;
          p.y *= t;               // grow along the bond axis
          vec4 mv = instanceMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(uColor, vAlpha * 0.22);
        }
      `,
    });

    this.bondMesh = new THREE.InstancedMesh(bondGeo, bondMat, bondCount);
    this.bondMesh.frustumCulled = false;

    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const mid = new THREE.Vector3();

    this.bonds.forEach((b, i) => {
      const pa = sites[b.a].clone().multiplyScalar(scale);
      const pb = sites[b.b].clone().multiplyScalar(scale);
      dir.subVectors(pb, pa);
      const len = dir.length();
      mid.addVectors(pa, pb).multiplyScalar(0.5);
      quat.setFromUnitVectors(up, dir.normalize());

      this.dummy.position.copy(mid);
      this.dummy.quaternion.copy(quat);
      this.dummy.scale.set(1, len, 1);
      this.dummy.updateMatrix();
      this.bondMesh.setMatrixAt(i, this.dummy.matrix);

      bondDelay[i] =
        (Math.max(sites[b.a].length(), sites[b.b].length()) / maxDist) * 0.55;
    });

    bondGeo.setAttribute(
      "aBondDelay",
      new THREE.InstancedBufferAttribute(bondDelay, 1)
    );
    this.bondMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.bondMesh);
  }

  get atomCount() {
    return this.positions.length;
  }
  get bondCount() {
    return this.bonds.length;
  }

  /** `snap` 0→1 drives crystallization; pure function of scroll. */
  update(snap: number, time: number) {
    const s = clamp01(snap);
    this.atomUniforms.uSnap.value = s;
    this.atomUniforms.uTime.value = time;
    // Bonds trail the atoms slightly — they form once the sites are in place.
    this.bondUniforms.uGrow.value = clamp01((s - 0.22) / 0.78);
    this.group.rotation.y = time * 0.06;
  }

  dispose() {
    this.atomMesh.geometry.dispose();
    (this.atomMesh.material as THREE.Material).dispose();
    this.bondMesh.geometry.dispose();
    (this.bondMesh.material as THREE.Material).dispose();
  }
}
