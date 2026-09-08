import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { Stone } from "./Stone";
import { Sparks } from "./Sparks";
import { Starfield } from "./Starfield";
import { Wand } from "./Wand";
import { useScrollProgress } from "@lib/useScrollProgress";
import { acts, damp, smoothstep, wandPose, type Acts } from "@lib/choreography";
import { POINTER, decayPointer, initPointer } from "@lib/pointer";

/**
 * Chaos → discovery → control → understanding.
 *
 * On arrival the field is wide and turbulent and the wand is not yet in frame.
 * It sweeps in, and from then on scroll drives three tricks while the pointer
 * disturbs the material and dragging turns the whole world. The user is never
 * only watching.
 *
 *   I   THE REVEAL   the wand rises, dust gathers, a stone appears
 *   II  THE DIVIDE   the wand taps, one stone becomes three
 *   III THE VANISH   the wand sweeps out, the dust scatters
 */
function Act({
  actsRef,
  tipRef,
  introRef,
  progress,
}: {
  actsRef: React.RefObject<Acts>;
  tipRef: React.RefObject<THREE.Vector3>;
  introRef: React.RefObject<number>;
  progress: React.RefObject<number>;
}) {
  const orbit = useRef<THREE.Group>(null!);
  const wand = useRef<THREE.Group>(null!);
  const smooth = useRef(0);
  const worldTip = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, dt) => {
    const d = Math.min(dt, 1 / 30);
    decayPointer(d);

    // Arrival ramp, independent of scroll: chaos first, then the wand.
    introRef.current = Math.min(1, (introRef.current ?? 0) + d / 2.4);
    const arrival = smoothstep(introRef.current);

    // Smooths the animation's pursuit of scroll, never the scroll itself.
    smooth.current = damp(smooth.current, progress.current ?? 0, 6, d);
    const p = smooth.current;
    const a = acts(p);
    actsRef.current = a;

    const t = state.clock.elapsedTime;

    // Drag turns the world. This is the moment the user learns they have hands.
    orbit.current.rotation.y = damp(orbit.current.rotation.y, POINTER.orbitY, 5, d);
    orbit.current.rotation.x = damp(orbit.current.rotation.x, POINTER.orbitX, 5, d);

    // One continuous gesture read as three tricks; pure function of scroll,
    // see lib/choreography.ts. The wand flies in from off-frame on arrival.
    const pose = wandPose(p, Math.sin(t * 0.9) * 0.05);
    const g = wand.current;
    g.position.set(pose.x - (1 - arrival) * 4.5, pose.y - (1 - arrival) * 2.2, pose.z);
    g.rotation.z = pose.rz + (1 - arrival) * 1.1;
    g.rotation.x = Math.sin(t * 0.7) * 0.06;
    g.scale.setScalar(arrival);

    worldTip.set(0, 1.2, 0);
    g.localToWorld(worldTip);
    tipRef.current?.copy(worldTip);

    // Damped pointer parallax, and a pull-back so the trio stays framed.
    const cam = state.camera;
    cam.position.x = damp(cam.position.x, POINTER.nx * 0.5, 3, d);
    cam.position.y = damp(cam.position.y, -POINTER.ny * 0.3, 3, d);
    cam.position.z = damp(cam.position.z, 5.1 + smoothstep(a.split) * 1.5, 3, d);
    cam.lookAt(0, 0, 0);
  });

  return (
    <group ref={orbit}>
      <Wand ref={wand} />
    </group>
  );
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
  const introRef = useRef(0);
  const [lowPower, setLowPower] = useState(false);

  useEffect(() => {
    setLowPower(
      matchMedia("(pointer: coarse)").matches ||
        (navigator.hardwareConcurrency ?? 8) <= 4
    );
  }, []);

  useEffect(() => {
    if (!allowed) return;
    return initPointer();
  }, [allowed]);

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
      <Starfield count={lowPower ? 600 : 1400} />
      <Act actsRef={actsRef} tipRef={tipRef} introRef={introRef} progress={progress} />
      <Sparks count={lowPower ? 240 : 460} actsRef={actsRef} tip={tipRef} intro={introRef} />
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
