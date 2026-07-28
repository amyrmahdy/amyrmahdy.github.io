import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { Stone } from "./Stone";
import { Sparks } from "./Sparks";
import { Wand } from "./Wand";
import { useScrollProgress } from "@lib/useScrollProgress";
import { acts, damp, smoothstep, wandPose, type Acts } from "@lib/choreography";

/**
 * Three tricks, driven by the page scroll.
 *
 *   I   THE REVEAL   the wand sweeps, the dust gathers, a stone appears
 *   II  THE DIVIDE   the wand taps, one stone becomes three
 *   III THE VANISH   the wand sweeps back, everything returns to dust
 */
function Act({
  actsRef,
  tipRef,
  progress,
}: {
  actsRef: React.RefObject<Acts>;
  tipRef: React.RefObject<THREE.Vector3>;
  progress: React.RefObject<number>;
}) {
  const wand = useRef<THREE.Group>(null!);
  const smooth = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const worldTip = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((state, dt) => {
    const d = Math.min(dt, 1 / 30);
    // Smooths the animation's pursuit of scroll without touching scroll itself.
    smooth.current = damp(smooth.current, progress.current ?? 0, 6, d);
    const p = smooth.current;
    const a = acts(p);
    actsRef.current = a;

    const t = state.clock.elapsedTime;
    const g = wand.current;

    // One continuous gesture, read as three tricks. Pure function of scroll —
    // see lib/choreography.ts, which is unit-tested.
    const pose = wandPose(p, Math.sin(t * 0.9) * 0.05);
    g.position.set(pose.x, pose.y, pose.z);
    g.rotation.z = pose.rz;
    g.rotation.x = Math.sin(t * 0.7) * 0.06;

    // World position of the glowing tip, for the sparks to chase.
    worldTip.set(0, 1.2, 0);
    g.localToWorld(worldTip);
    tipRef.current?.copy(worldTip);

    // Damped pointer parallax on the camera.
    const cam = state.camera;
    cam.position.x = damp(cam.position.x, pointer.current.x * 0.55, 3, d);
    cam.position.y = damp(cam.position.y, -pointer.current.y * 0.32, 3, d);
    // Pulls back a touch as the stones spread so the trio stays framed.
    cam.position.z = damp(cam.position.z, 5.1 + smoothstep(a.split) * 1.5, 3, d);
    cam.lookAt(0, 0, 0);
  });

  return <Wand ref={wand} />;
}

function useAllowed() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const reduced =
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      localStorage.getItem("amm:reduce-motion") === "1";
    if (reduced) return;
    if ((navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData)
      return;
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2", { failIfMajorPerformanceCaveat: true });
      if (!gl) return;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      return;
    }
    setOk(true);
  }, []);
  return ok;
}

export default function Scene() {
  const allowed = useAllowed();
  const progress = useScrollProgress();
  const actsRef = useRef<Acts>({ reveal: 0, split: 0, vanish: 0 });
  const tipRef = useRef(new THREE.Vector3());
  const [lowPower, setLowPower] = useState(false);

  useEffect(() => {
    setLowPower(
      matchMedia("(pointer: coarse)").matches ||
        (navigator.hardwareConcurrency ?? 8) <= 4
    );
  }, []);

  if (!allowed) return null;

  return (
    <Canvas
      dpr={[1, lowPower ? 1 : 1.75]}
      gl={{
        antialias: false,
        alpha: true,
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: true,
      }}
      camera={{ position: [0, 0, 5.1], fov: 40 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
        document.documentElement.classList.add("gl-active");
      }}
    >
      <Act actsRef={actsRef} tipRef={tipRef} progress={progress} />
      <Sparks count={lowPower ? 240 : 460} actsRef={actsRef} tip={tipRef} />
      <Stone actsRef={actsRef} lowPower={lowPower} />

      {/* Small, intensely bright sources: dispersion is invisible against a
          soft environment, which averages the three channels back together.
          Built from Lightformers, so there is no HDR to fetch. */}
      <Environment resolution={256}>
        <Lightformer intensity={10} position={[2, 3, 4]} scale={[3, 1, 1]} />
        <Lightformer intensity={5} position={[-3, 1, 2]} scale={[2, 0.6, 1]} color="#bfe9ff" />
        <Lightformer intensity={3} position={[0, -3, 2]} scale={[4, 1, 1]} color="#ff9b50" />
        <Lightformer intensity={1.6} form="ring" position={[0, 0, -5]} scale={[7, 7, 1]} />
      </Environment>

      <EffectComposer enableNormalPass={false}>
        <Bloom
          intensity={0.85}
          luminanceThreshold={0.55}
          luminanceSmoothing={0.3}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.24} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  );
}
