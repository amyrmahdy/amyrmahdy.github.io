import { forwardRef, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * A conductor's baton. Local +Y is the shaft; the group origin is the hand.
 * The parent owns position, quaternion and scale — this component only
 * breathes light into the tip from the `glow` ref.
 */
const PROFILE: [number, number][] = [
  [0, -0.06],
  [0.012, -0.05],
  [0.019, -0.02],
  [0.021, 0.01],
  [0.018, 0.05],
  [0.012, 0.08],
  [0.006, 0.1],
  [0.004, 0.1],
];

export const Baton = forwardRef<THREE.Group, { glow: React.RefObject<number> }>(
  function Baton({ glow }, ref) {
    const light = useRef<THREE.PointLight>(null!);
    const tipMat = useRef<THREE.MeshBasicMaterial>(null!);

    const bulb = useMemo(
      () => new THREE.LatheGeometry(PROFILE.map(([x, y]) => new THREE.Vector2(x, y)), 24),
      []
    );
    const shaft = useMemo(() => new THREE.CylinderGeometry(0.0015, 0.004, 0.42, 12), []);
    const tip = useMemo(() => new THREE.SphereGeometry(0.006, 12, 12), []);

    useFrame(() => {
      const g = glow.current ?? 1;
      light.current.intensity = 4 * g;
      tipMat.current.color.setScalar(0.35 + 0.65 * g);
    });

    return (
      <group ref={ref}>
        {/* bulb: pear-shaped grip, narrow end meeting the shaft at y = 0.10 */}
        <mesh geometry={bulb}>
          <meshStandardMaterial color="#b9c2c8" roughness={0.6} metalness={0.05} />
        </mesh>
        {/* shaft: spans 0.10..0.52 */}
        <mesh geometry={shaft} position={[0, 0.31, 0]}>
          <meshStandardMaterial color="#eef2f5" roughness={0.35} metalness={0.05} />
        </mesh>
        {/* tip: the one lit point */}
        <mesh geometry={tip} position={[0, 0.52, 0]}>
          <meshBasicMaterial ref={tipMat} color="#ffffff" toneMapped={false} />
        </mesh>
        <pointLight ref={light} position={[0, 0.52, 0]} color="#dff2ff" distance={6} decay={2} />
      </group>
    );
  }
);
