import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { Stone } from "./Stone";
import { Carbon } from "./Carbon";

/** Drives the arrival transmutation once, on mount. */
function Reveal({ target }: { target: React.RefObject<number> }) {
  useFrame((_, dt) => {
    target.current = Math.min(1, (target.current ?? 0) + dt / 2.2);
  });
  return null;
}

/** Damped pointer parallax, so nothing feels twitchy. */
function Parallax() {
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      target.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((state) => {
    state.camera.position.x += (target.current.x * 0.5 - state.camera.position.x) * 0.04;
    state.camera.position.y += (-target.current.y * 0.3 - state.camera.position.y) * 0.04;
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

function useAllowed() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const reduced =
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      localStorage.getItem("amm:reduce-motion") === "1";
    if (reduced) return;
    if ((navigator as never as { connection?: { saveData?: boolean } }).connection?.saveData) return;

    // failIfMajorPerformanceCaveat pushes software-rasterised WebGL — VMs and
    // locked-down corporate laptops, a real slice of this audience — to the
    // static poster rather than letting it run at 4fps.
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
  const reveal = useRef(0);
  const coarse =
    typeof window !== "undefined" && matchMedia("(pointer: coarse)").matches;

  if (!allowed) return null;

  return (
    <Canvas
      className="scene-canvas"
      dpr={[1, coarse ? 1 : 1.75]}
      gl={{
        antialias: false,
        alpha: true,
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: true,
      }}
      camera={{ position: [0, 0, 5.2], fov: 38 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.15;
        document.documentElement.classList.add("gl-active");
      }}
    >
      <Reveal target={reveal} />
      <Parallax />

      <Carbon count={coarse ? 240 : 420} reveal={reveal} />
      <Stone reveal={reveal} />

      {/* Dispersion only shows against small, intensely bright sources — a big
          soft environment averages the channels back together and the fire dies.
          Lightformers keep it local, so there is no HDR to fetch. */}
      <Environment resolution={256}>
        <Lightformer intensity={12} position={[2, 3, 4]} scale={[3, 1, 1]} />
        <Lightformer intensity={6} position={[-3, 1, 2]} scale={[2, 0.6, 1]} color="#bfe9ff" />
        <Lightformer intensity={4} position={[0, -3, 2]} scale={[4, 1, 1]} color="#ff9b50" />
        <Lightformer
          intensity={2}
          form="ring"
          position={[0, 0, -4]}
          scale={[6, 6, 1]}
        />
      </Environment>

      <EffectComposer enableNormalPass={false}>
        <Bloom intensity={0.7} luminanceThreshold={0.62} luminanceSmoothing={0.25} mipmapBlur />
        <Vignette eskil={false} offset={0.25} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  );
}
