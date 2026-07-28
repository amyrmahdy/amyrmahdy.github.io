import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";
import { buildBrilliant } from "@lib/brilliant";

/**
 * The stone. Diamond's real IOR is 2.417 and its dispersion (0.044) is the
 * highest of any common gemstone — that spread is the fire, so chromatic
 * aberration is turned up rather than tastefully restrained.
 */
export function Stone({ reveal }: { reveal: React.RefObject<number> }) {
  const geo = useMemo(() => buildBrilliant(16), []);
  const mesh = useRef<THREE.Mesh>(null!);
  const group = useRef<THREE.Group>(null!);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const r = reveal.current ?? 1;

    // Rises and settles as the carbon collapses into it.
    group.current.position.y = (1 - r) * -0.35;
    group.current.scale.setScalar(0.55 + 0.45 * r);

    mesh.current.rotation.y += dt * 0.28;
    // A slow nod so the crown catches the key light rather than sitting flat.
    mesh.current.rotation.z = Math.sin(t * 0.35) * 0.13;
  });

  return (
    <group ref={group}>
      <mesh ref={mesh} geometry={geo} scale={1.35}>
        <MeshTransmissionMaterial
          transmission={1}
          thickness={1.4}
          ior={2.417}
          chromaticAberration={0.62}
          anisotropy={0.3}
          distortion={0.1}
          distortionScale={0.2}
          temporalDistortion={0.05}
          roughness={0}
          samples={6}
          resolution={512}
          backside
          backsideThickness={0.6}
          color="#ffffff"
          attenuationColor="#dff4ff"
          attenuationDistance={3}
        />
      </mesh>
    </group>
  );
}
