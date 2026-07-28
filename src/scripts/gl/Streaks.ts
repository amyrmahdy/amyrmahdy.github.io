/**
 * Kimberlite debris during the eruption.
 *
 * Stretched along the camera-space velocity vector in the vertex shader rather
 * than blurred in post: it costs nothing extra and reads as speed more honestly
 * than any motion-blur pass at this budget.
 */
import * as THREE from "three";
import { clamp01 } from "./curve";

const COUNT = 700;
const SPAN = 210; // km of column the debris wraps within
const RADIUS = 20;

export class Streaks {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private uniforms: {
    uDepth: { value: number };
    uVel: { value: number };
    uColor: { value: THREE.Color };
    uHot: { value: THREE.Color };
  };

  constructor() {
    const geo = new THREE.PlaneGeometry(0.035, 1);

    const seed = new Float32Array(COUNT);
    const offset = new Float32Array(COUNT);
    const radial = new Float32Array(COUNT * 2);

    for (let i = 0; i < COUNT; i++) {
      const r = Math.sqrt(Math.random()) * RADIUS;
      const a = Math.random() * Math.PI * 2;
      radial[i * 2] = Math.cos(a) * r;
      radial[i * 2 + 1] = Math.sin(a) * r;
      offset[i] = Math.random() * SPAN;
      seed[i] = Math.random();
    }

    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));
    geo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offset, 1));
    geo.setAttribute("aRadial", new THREE.InstancedBufferAttribute(radial, 2));

    this.uniforms = {
      uDepth: { value: 0 },
      uVel: { value: 0 },
      uColor: { value: new THREE.Color("#eef9fd") },
      uHot: { value: new THREE.Color("#ff9b50") },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aSeed;
        attribute float aOffset;
        attribute vec2 aRadial;
        uniform float uDepth;
        uniform float uVel;
        varying float vAlpha;
        varying float vSeed;

        void main() {
          float y = mod(aOffset + uDepth * (0.6 + aSeed * 0.8), ${SPAN.toFixed(1)});
          // Length scales with velocity — at rest these are dots, at speed they
          // are long streaks. Same geometry, no extra cost.
          float stretch = 0.6 + uVel * 22.0 * (0.5 + aSeed);
          vec3 p = position;
          p.y *= stretch;

          vec3 world = vec3(aRadial.x, y - uDepth, aRadial.y) + vec3(p.x, p.y, 0.0);
          vAlpha = uVel * (0.35 + 0.65 * aSeed);
          vSeed = aSeed;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform vec3 uHot;
        varying float vAlpha;
        varying float vSeed;
        void main() {
          vec3 c = mix(uHot, uColor, vSeed);
          float a = vAlpha * 0.5;
          if (a < 0.004) discard;
          gl_FragColor = vec4(c, a);
        }
      `,
    });

    this.mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }

  update(depth: number, vel: number, _t: number) {
    this.uniforms.uDepth.value = depth;
    this.uniforms.uVel.value = clamp01(vel);
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
