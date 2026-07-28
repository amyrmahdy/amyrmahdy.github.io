/**
 * The descent. Rock strata streaming past the camera as annuli, warming from
 * cold rule-work to incandescence as depth increases.
 *
 * Deliberately near-empty: chapters 2–3 must feel patient and unoccupied, and
 * that emptiness is what earns the density of the lattice and the eruption.
 * At most two things animate at once during the descent.
 */
import * as THREE from "three";
import { clamp01, invLerp } from "./curve";

const LAYERS = 60;
const SPACING = 3.4; // km between rules
const RADIUS = 26;

export class Strata {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private uniforms: {
    uDepth: { value: number };
    uHeat: { value: number };
    uCold: { value: THREE.Color };
    uEmber: { value: THREE.Color };
  };

  constructor() {
    const geo = new THREE.RingGeometry(RADIUS, RADIUS + 0.06, 96, 1);

    const offset = new Float32Array(LAYERS);
    const jitter = new Float32Array(LAYERS);
    for (let i = 0; i < LAYERS; i++) {
      offset[i] = i * SPACING;
      jitter[i] = (Math.sin(i * 91.7) * 43758.5453) % 1;
    }
    geo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offset, 1));
    geo.setAttribute("aJitter", new THREE.InstancedBufferAttribute(jitter, 1));

    this.uniforms = {
      uDepth: { value: 0 },
      uHeat: { value: 0 },
      uCold: { value: new THREE.Color("#3a4550") },
      uEmber: { value: new THREE.Color("#ff9b50") },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aOffset;
        attribute float aJitter;
        uniform float uDepth;
        varying float vFade;
        varying float vJitter;

        void main() {
          float span = ${(LAYERS * SPACING).toFixed(1)};
          // Wrap the ring stack around the camera so a finite set of rules
          // reads as an endless column of rock.
          float y = -(mod(aOffset - uDepth, span));
          vec3 p = position;
          p.z = y;                       // ring lies in XY, pushed along -Z

          // Fade in at the far end, out as it passes the camera.
          float d = abs(y + span * 0.5);
          vFade = smoothstep(span * 0.5, span * 0.16, d);
          vJitter = aJitter;

          vec4 world = vec4(p.x, y, p.y, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uHeat;
        uniform vec3 uCold;
        uniform vec3 uEmber;
        varying float vFade;
        varying float vJitter;
        void main() {
          vec3 c = mix(uCold, uEmber, uHeat);
          float a = vFade * (0.10 + 0.16 * vJitter) * (0.45 + 0.55 * uHeat);
          if (a < 0.002) discard;
          gl_FragColor = vec4(c, a);
        }
      `,
    });

    this.mesh = new THREE.InstancedMesh(geo, mat, LAYERS);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }

  update(depth: number, temp: number, p: number) {
    this.uniforms.uDepth.value = depth;
    // Heat tracks temperature, but fades out once the ascent begins so the
    // surface reads cold again.
    const cooling = p > 0.8 ? 1 - clamp01(invLerp(0.8, 0.95, p)) : 1;
    this.uniforms.uHeat.value = clamp01(invLerp(20, 1150, temp)) * cooling;
    this.group.visible = p < 0.94;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
