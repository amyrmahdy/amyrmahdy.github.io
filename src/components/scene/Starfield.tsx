import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { POINTER } from "@lib/pointer";

/**
 * The far layer. Gives the frame a floor of depth and scale so the stone reads
 * as an object suspended in something, rather than a render on a flat black
 * background.
 *
 * One draw call, no per-frame CPU work: the drift and twinkle are computed in
 * the vertex shader from uniforms. Three depth shells parallax against each
 * other as the pointer moves, which is what sells the space as space.
 */
export function Starfield({ count = 1400 }: { count?: number }) {
  const points = useRef<THREE.Points>(null!);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uColor: { value: new THREE.Color("#cfe4f2") },
    }),
    []
  );

  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const depth = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Shell-distributed rather than cube-distributed: no visible corners.
      const t = i / count;
      const phi = Math.acos(1 - 2 * ((i * 0.618033988749895) % 1));
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const shell = 14 + Math.floor(t * 3) * 9; // three depth bands
      const r = shell + ((Math.sin(i * 91.7) + 1) / 2) * 5;

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi) - 12;
      seed[i] = (Math.sin(i * 12.9898) + 1) / 2;
      depth[i] = Math.floor(t * 3) / 2; // 0, 0.5, 1
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aDepth", new THREE.BufferAttribute(depth, 1));
    return g;
  }, [count]);

  useFrame((state, dt) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uEnergy.value += (POINTER.energy - uniforms.uEnergy.value) * Math.min(1, dt * 4);
    // Near shells swing further than far ones — that difference is the depth.
    points.current.rotation.y += dt * 0.006;
    points.current.rotation.x = POINTER.ny * 0.05;
    points.current.rotation.z = POINTER.nx * 0.03;
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={/* glsl */ `
          attribute float aSeed;
          attribute float aDepth;
          uniform float uTime;
          uniform float uEnergy;
          varying float vAlpha;

          void main() {
            vec3 p = position;
            // Slow independent drift per shell.
            float d = 1.0 - aDepth * 0.65;
            p.x += sin(uTime * 0.05 + aSeed * 6.28) * 0.6 * d;
            p.y += cos(uTime * 0.04 + aSeed * 4.19) * 0.5 * d;

            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;

            // Twinkle, plus a lift when the pointer is moving hard — the whole
            // field acknowledges the user without anything jumping.
            float tw = 0.55 + 0.45 * sin(uTime * (0.7 + aSeed) + aSeed * 12.0);
            vAlpha = (0.10 + 0.42 * aSeed) * tw * d * (1.0 + uEnergy * 0.7);
            gl_PointSize = (1.0 + aSeed * 1.8) * d * (300.0 / -mv.z);
          }
        `}
        fragmentShader={/* glsl */ `
          uniform vec3 uColor;
          varying float vAlpha;
          void main() {
            // Round, soft-edged points. Square stars look like dead pixels.
            vec2 c = gl_PointCoord - 0.5;
            float m = smoothstep(0.5, 0.0, length(c));
            if (m < 0.01) discard;
            gl_FragColor = vec4(uColor, vAlpha * m);
          }
        `}
      />
    </points>
  );
}
