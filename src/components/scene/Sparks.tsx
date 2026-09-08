import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { latticeSites } from "@lib/brilliant";
import { clamp01, lerp, type Acts } from "@lib/choreography";
import { POINTER } from "@lib/pointer";

/**
 * Carbon dust — and the part of the scene the user can actually push around.
 *
 * The arc is chaos → order: at rest the field is wide and turbulent, and as the
 * trick proceeds it collapses into the diamond lattice. The pointer displaces
 * it the whole way through, so the disorder is never merely decorative; it is
 * something the reader is visibly disturbing.
 *
 * Positions are integrated with velocity rather than assigned, which is what
 * makes the displacement feel like matter instead of like a hover state.
 */
export function Sparks({
  count = 460,
  actsRef,
  tip,
  intro,
}: {
  count?: number;
  actsRef: React.RefObject<Acts>;
  tip: React.RefObject<THREE.Vector3>;
  /** 0–1 arrival ramp: the field is at its wildest before the wand appears. */
  intro: React.RefObject<number>;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const cursor = useMemo(() => new THREE.Vector3(), []);
  const delta = useMemo(() => new THREE.Vector3(), []);

  const data = useMemo(() => {
    const sites = latticeSites(count);
    const n = sites.length;
    const orbit: THREE.Vector3[] = [];
    const scatter: THREE.Vector3[] = [];
    const live: THREE.Vector3[] = [];
    const vel: THREE.Vector3[] = [];
    const phase: number[] = [];
    const isTip: boolean[] = [];
    const delay: number[] = [];
    const maxR = Math.max(...sites.map((s) => s.length())) || 1;

    for (let i = 0; i < n; i++) {
      const t = i / n;
      const phi = Math.acos(1 - 2 * t);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = 2.6 + 1.9 * ((Math.sin(i * 12.9898) + 1) / 2);
      const o = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta) * 0.55,
        r * Math.cos(phi)
      );
      orbit.push(o);
      scatter.push(o.clone().multiplyScalar(3.4));
      live.push(o.clone().multiplyScalar(2.1)); // starts wide, falls inward
      vel.push(new THREE.Vector3());
      phase.push(t * Math.PI * 2);
      isTip.push(i % 4 === 0);
      delay.push((sites[i].length() / maxR) * 0.45);
    }
    return { sites, orbit, scatter, live, vel, phase, isTip, delay, n };
  }, [count]);

  useFrame((state, dt) => {
    const a = actsRef.current;
    if (!a) return;
    const d = Math.min(dt, 1 / 30);
    const t = state.clock.elapsedTime;
    const tipPos = tip.current;
    const arrival = intro.current ?? 1;

    // Pointer projected onto the z=0 plane, so the force acts where the user
    // actually sees their cursor rather than somewhere behind the scene.
    cursor.set(POINTER.nx, -POINTER.ny, 0.5).unproject(state.camera);
    cursor.sub(state.camera.position).normalize();
    const dist = -state.camera.position.z / cursor.z;
    cursor.multiplyScalar(dist).add(state.camera.position);

    // Chaos before the wand arrives, order once the lattice takes.
    const turbulence = lerp(1.15, 0.18, arrival);

    for (let i = 0; i < data.n; i++) {
      const o = data.orbit[i];
      const ph = data.phase[i];
      const gather = clamp01((a.reveal - data.delay[i]) / 0.4);

      // ── where this spark wants to be ──────────────────────────────────
      const swirlRate = 0.18 + turbulence * 0.5;
      target.set(
        o.x * Math.cos(t * swirlRate + ph) - o.z * Math.sin(t * swirlRate + ph),
        o.y + Math.sin(t * (0.5 + turbulence) + ph) * (0.12 + turbulence * 0.5),
        o.x * Math.sin(t * swirlRate + ph) + o.z * Math.cos(t * swirlRate + ph)
      );
      if (arrival < 1) target.multiplyScalar(lerp(2.1, 1, arrival));

      if (data.isTip[i] && tipPos) {
        target.lerp(tipPos, (1 - a.reveal) * arrival * 0.55 * (0.35 + ((i % 7) / 7) * 0.65));
      }
      if (gather > 0) target.lerp(data.sites[i], gather);
      if (a.split > 0) target.multiplyScalar(1 + a.split * 0.85);
      if (a.vanish > 0) target.lerp(data.scatter[i], a.vanish);

      // ── integrate, so displacement has weight ─────────────────────────
      const pos = data.live[i];
      const v = data.vel[i];
      // Springs harder once locked into the lattice: order resists disturbance.
      const k = lerp(6, 26, gather);
      v.x += (target.x - pos.x) * k * d;
      v.y += (target.y - pos.y) * k * d;
      v.z += (target.z - pos.z) * k * d;

      // ── the user's hand ───────────────────────────────────────────────
      if (POINTER.active) {
        delta.subVectors(pos, cursor);
        const dsq = delta.lengthSq();
        if (dsq < 6.25) {
          // Inverse-square push, softened near zero so nothing explodes.
          const f = (1.6 + POINTER.energy * 4.5) / (dsq + 0.35);
          // A settled lattice yields less — you can disturb it, not destroy it.
          const grip = lerp(1, 0.32, gather);
          delta.normalize().multiplyScalar(f * grip * d * 9);
          v.add(delta);
        }
      }

      v.multiplyScalar(Math.exp(-4.2 * d)); // drag
      pos.addScaledVector(v, d);

      dummy.position.copy(pos);
      dummy.scale.setScalar((1 - gather * 0.55) * (1 - a.vanish * 0.7) * arrival);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;

    const mat = mesh.current.material as THREE.MeshBasicMaterial;
    mat.opacity = lerp(0.85, 0.3, a.reveal) * (1 - a.vanish * 0.95) * arrival;
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
