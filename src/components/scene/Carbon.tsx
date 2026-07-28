import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { latticeSites } from "@lib/brilliant";

/**
 * The trick, and it runs on arrival rather than on scroll: scattered carbon
 * collapses into the diamond lattice in about two seconds. Same element as
 * graphite — the arrangement is the whole difference.
 */
export function Carbon({
  count = 420,
  reveal,
}: {
  count?: number;
  reveal: React.RefObject<number>;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const { sites, chaos, delay } = useMemo(() => {
    const sites = latticeSites(count);
    const chaos: THREE.Vector3[] = [];
    const delay: number[] = [];
    const maxR = Math.max(...sites.map((s) => s.length())) || 1;

    sites.forEach((s, i) => {
      // Golden-angle spiral: even scatter with no clumping.
      const t = i / sites.length;
      const phi = Math.acos(1 - 2 * t);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = 3.2 + 1.8 * ((Math.sin(i * 12.9898) + 1) / 2);
      chaos.push(
        new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi)
        )
      );
      // Nucleation: the centre lands first and growth propagates outward, so
      // the crystal appears to grow rather than teleport.
      delay.push((s.length() / maxR) * 0.5);
    });
    return { sites, chaos, delay };
  }, [count]);

  useFrame((state) => {
    const r = reveal.current ?? 1;
    const t = state.clock.elapsedTime;

    for (let i = 0; i < sites.length; i++) {
      const local = Math.max(0, Math.min(1, (r - delay[i]) / 0.4));
      // easeOutBack — the overshoot is the difference between a snap and a drift
      const f = local - 1;
      const e = 1 + 2.9 * f * f * f + 1.9 * f * f;

      const c = chaos[i];
      const s = sites[i];
      const wobble = (1 - local) * 0.25;
      dummy.position.set(
        c.x + (s.x - c.x) * e + Math.sin(t * 0.9 + i) * wobble,
        c.y + (s.y - c.y) * e + Math.cos(t * 0.8 + i) * wobble,
        c.z + (s.z - c.z) * e
      );
      // Atoms shrink as they lock in — the cloud dissolves into the stone.
      dummy.scale.setScalar((1 - local * 0.75) * 0.9);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;

    const mat = mesh.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.5 * (1 - r) + 0.06;
    mesh.current.rotation.y = t * 0.05;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, sites.length]}>
      <sphereGeometry args={[0.028, 8, 8]} />
      <meshBasicMaterial
        color="#eef9fd"
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}
