import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { latticeSites } from "@lib/brilliant";
import { clamp01, lerp, type Acts } from "@lib/choreography";

/**
 * Carbon dust. It is what the stone is pulled out of, and what it collapses
 * back into — the metaphor survives, at the size of a prop rather than a thesis.
 *
 * A quarter of the sparks are "tip sparks" that chase the wand, so the wand
 * visibly drags the material around rather than waving near it.
 */
export function Sparks({
  count = 460,
  actsRef,
  tip,
}: {
  count?: number;
  actsRef: React.RefObject<Acts>;
  tip: React.RefObject<THREE.Vector3>;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  const data = useMemo(() => {
    const sites = latticeSites(count);
    const n = sites.length;
    const orbit: THREE.Vector3[] = [];
    const scatter: THREE.Vector3[] = [];
    const phase: number[] = [];
    const isTip: boolean[] = [];
    const maxR = Math.max(...sites.map((s) => s.length())) || 1;
    const delay: number[] = [];

    for (let i = 0; i < n; i++) {
      const t = i / n;
      const phi = Math.acos(1 - 2 * t);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = 2.6 + 1.9 * ((Math.sin(i * 12.9898) + 1) / 2);
      orbit.push(
        new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta) * 0.55,
          r * Math.cos(phi)
        )
      );
      scatter.push(orbit[i].clone().multiplyScalar(3.4));
      phase.push(t * Math.PI * 2);
      isTip.push(i % 4 === 0);
      delay.push((sites[i].length() / maxR) * 0.45);
    }
    return { sites, orbit, scatter, phase, isTip, delay, n };
  }, [count]);

  useFrame((state, dt) => {
    const a = actsRef.current;
    if (!a) return;
    const t = state.clock.elapsedTime;
    const tipPos = tip.current;

    for (let i = 0; i < data.n; i++) {
      const o = data.orbit[i];
      const ph = data.phase[i];

      // Idle swirl — the dust is never quite still.
      tmp.set(
        o.x * Math.cos(t * 0.18 + ph) - o.z * Math.sin(t * 0.18 + ph),
        o.y + Math.sin(t * 0.5 + ph) * 0.12,
        o.x * Math.sin(t * 0.18 + ph) + o.z * Math.cos(t * 0.18 + ph)
      );

      // A quarter of them are dragged toward the wand tip before the reveal,
      // so the material looks summoned rather than merely present.
      if (data.isTip[i] && tipPos) {
        const pull = (1 - a.reveal) * 0.55;
        tmp.lerp(tipPos, pull * (0.35 + 0.65 * ((i % 7) / 7)));
      }

      // ACT I — collapse into the lattice.
      const gather = clamp01((a.reveal - data.delay[i]) / 0.4);
      if (gather > 0) tmp.lerp(data.sites[i], gather);

      // ACT II — pushed out again as the stone divides.
      if (a.split > 0) {
        const push = 1 + a.split * 0.85;
        tmp.multiplyScalar(push);
      }

      // ACT III — thrown outward and gone.
      if (a.vanish > 0) tmp.lerp(data.scatter[i], a.vanish);

      dummy.position.copy(tmp);
      const shrink = 1 - gather * 0.55;
      dummy.scale.setScalar(shrink * (1 - a.vanish * 0.7));
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;

    const mat = mesh.current.material as THREE.MeshBasicMaterial;
    // Brightest during the summon, then it steps aside for the stone.
    mat.opacity = lerp(0.85, 0.3, a.reveal) * (1 - a.vanish * 0.95);
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, data.n]} frustumCulled={false}>
      <sphereGeometry args={[0.022, 6, 6]} />
      <meshBasicMaterial
        color="#eaf6ff"
        transparent
        depthWrite={false}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}
