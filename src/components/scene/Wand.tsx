import { forwardRef, useMemo } from "react";
import * as THREE from "three";

/**
 * The mark. A magician's wand: dark rod, bright tips, and a tip light that is
 * the only real light source in the scene — so the stone is lit by the wand,
 * which is the whole idea.
 */
export const Wand = forwardRef<THREE.Group>(function Wand(_, ref) {
  const rod = useMemo(() => new THREE.CylinderGeometry(0.036, 0.03, 2.2, 20), []);
  const ferrule = useMemo(() => new THREE.CylinderGeometry(0.05, 0.05, 0.3, 20), []);
  const tip = useMemo(() => new THREE.SphereGeometry(0.075, 20, 20), []);

  return (
    <group ref={ref}>
      {/* rod runs along +Y; the working tip is at +Y */}
      <mesh geometry={rod}>
        <meshStandardMaterial color="#0b0d10" roughness={0.32} metalness={0.1} />
      </mesh>
      <mesh geometry={ferrule} position={[0, 0.98, 0]}>
        <meshStandardMaterial color="#e8eef2" roughness={0.18} metalness={0.9} />
      </mesh>
      <mesh geometry={ferrule} position={[0, -0.98, 0]}>
        <meshStandardMaterial color="#e8eef2" roughness={0.18} metalness={0.9} />
      </mesh>

      {/* the glowing tip */}
      <mesh geometry={tip} position={[0, 1.2, 0]}>
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <pointLight position={[0, 1.2, 0]} intensity={9} distance={9} decay={2} color="#dff2ff" />
    </group>
  );
});
