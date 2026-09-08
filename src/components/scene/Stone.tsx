import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";
import { buildBrilliant } from "@lib/brilliant";
import { clamp01, lerp, smoothstep, type Acts } from "@lib/choreography";

/**
 * The stone the wand produces.
 *
 * Only the centre stone gets MeshTransmissionMaterial — each instance of it
 * renders its own transmission buffer, so three would mean three extra passes
 * per frame. The two satellites of the multiplication use a reflective physical
 * material instead: at that size and speed nobody reads the difference, and it
 * costs nothing.
 */
export function Stone({
  actsRef,
  lowPower,
}: {
  actsRef: React.RefObject<Acts>;
  lowPower: boolean;
}) {
  const geo = useMemo(() => buildBrilliant(16), []);
  const hero = useRef<THREE.Group>(null!);
  const spin = useRef<THREE.Mesh>(null!);
  const satA = useRef<THREE.Group>(null!);
  const satB = useRef<THREE.Group>(null!);

  useFrame((state, dt) => {
    const a = actsRef.current;
    if (!a) return;
    const t = state.clock.elapsedTime;

    // ACT I — materialises out of the dust.
    const born = smoothstep(clamp01((a.reveal - 0.45) / 0.55));
    const alive = born * (1 - smoothstep(a.vanish) * 0.72);

    hero.current.scale.setScalar(alive * 1.25);
    hero.current.position.y = lerp(-0.25, 0, born);
    spin.current.rotation.y += dt * (0.34 + a.split * 0.5);
    spin.current.rotation.z = Math.sin(t * 0.4) * 0.12;

    // ACT II — the tap divides it. Satellites arc outward and settle.
    const s = smoothstep(a.split);
    const spread = 1.85 * s;
    for (const [ref, dir] of [
      [satA, -1],
      [satB, 1],
    ] as const) {
      const g = ref.current;
      g.scale.setScalar(alive * 0.52 * s);
      g.position.set(dir * spread, Math.sin(s * Math.PI) * 0.42, -0.3 * s);
      g.rotation.y = t * 0.6 * dir;
      g.rotation.z = dir * 0.3 * s;
    }
  });

  return (
    <group>
      <group ref={hero}>
        <mesh ref={spin} geometry={geo}>
          <MeshTransmissionMaterial
            transmission={1}
            thickness={1.3}
            ior={2.417}
            /* Dispersion 0.044 is the highest of any common gemstone; that
               spread is the fire, so this is pushed rather than tasteful. */
            chromaticAberration={0.7}
            anisotropy={0.25}
            distortion={0.08}
            distortionScale={0.2}
            temporalDistortion={0.04}
            roughness={0}
            samples={lowPower ? 3 : 6}
            resolution={lowPower ? 192 : 448}
            backside={!lowPower}
            backsideThickness={0.5}
            color="#ffffff"
            attenuationColor="#dff4ff"
            attenuationDistance={3.2}
          />
        </mesh>
      </group>

      {[satA, satB].map((ref, i) => (
        <group key={i} ref={ref}>
          <mesh geometry={geo}>
            <meshPhysicalMaterial
              color="#cfe8f5"
              metalness={0.35}
              roughness={0.06}
              reflectivity={1}
              clearcoat={1}
              clearcoatRoughness={0}
              iridescence={1}
              iridescenceIOR={2.4}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
