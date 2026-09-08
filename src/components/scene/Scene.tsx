import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei/core/Environment";
import { Lightformer } from "@react-three/drei/core/Lightformer";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { Orchestra } from "./Orchestra";
import { Baton } from "./Baton";
import { Starfield } from "./Starfield";
import { useScrollProgress } from "@lib/useScrollProgress";
import { POINTER, initPointer, decayPointer } from "@lib/pointer";
import type { AudioHandle } from "@lib/audio";
import {
  ARC_RADII, ARRIVAL, SEAT_Y,
  arrivalRate, batonPose, cameraRig, cutoffLatch, damp, hallLight, lerp, newConductor,
  release, releaseRadius, stageHit, thirdEmber, thirdLit,
  type Conductor,
} from "@lib/choreography";

/**
 * The podium. First person: the camera is a child of a rig group that is the
 * visitor's head; the baton is the only near-field object; the orchestra and
 * the vault are the world.
 *
 * Every number the scene needs is written once per frame into one shared
 * Conductor object and read by Orchestra; nothing here touches React state in
 * the frame path, and DOM writes are edge-triggered only.
 */

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n);

interface ConductProps {
  conductor: React.MutableRefObject<Conductor>;
  progress: React.MutableRefObject<number>;
  portrait: boolean;
  lowPower: boolean;
  audio: React.MutableRefObject<AudioHandle | null>;
  tapPending: React.MutableRefObject<{ nx: number; ny: number } | null>;
  copyMaskNdc: React.MutableRefObject<number[]>;
}

function Conduct({ conductor, progress, portrait, lowPower, audio, tapPending, copyMaskNdc }: ConductProps) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const rig = useRef<THREE.Group>(null!);
  const baton = useRef<THREE.Group>(null!);
  const glowRef = useRef(1);

  // Frame-path state: refs only.
  const smoothP = useRef(0);
  const arrivalT = useRef(0);
  const clock = useRef(-1);
  const beatT = useRef(-1);
  const downbeatId = useRef(0);
  const waveOrigin = useRef<number[]>([0, SEAT_Y, 0]);
  const headYaw = useRef(0);
  const headPitch = useRef(0);
  const stageDamped = useMemo(() => new THREE.Vector3(0, SEAT_Y, -3), []);
  const beamStrength = useRef(0);
  const energy = useRef(0);
  const hover = useRef([0, 0, 0]);
  const prevCutoff = useRef(false);
  const firedFirst = useRef(false);
  const liveSet = useRef(false);
  const prevMv = useRef("");
  const prevCue = useRef("");
  const prevCutoffClass = useRef(false);
  const prevAim = useRef(0);

  // Scratch — allocated once.
  const v = useMemo(() => new THREE.Vector3(), []);
  const eye = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const pivotWorld = useMemo(() => new THREE.Vector3(), []);
  const aimWorld = useMemo(() => new THREE.Vector3(), []);
  const aimLocal = useMemo(() => new THREE.Vector3(), []);
  const dirLocal = useMemo(() => new THREE.Vector3(), []);
  const rigQuat = useMemo(() => new THREE.Quaternion(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const qDip = useMemo(() => new THREE.Quaternion(), []);
  const eyeArr = useMemo(() => [0, 0, 0], []);
  const dirArr = useMemo(() => [0, 0, -1], []);
  const audioState = useMemo(
    () => ({ lock: [0, 0, 0, 0, 0], pulse: [0, 0, 0, 0, 0], beam: 0, beamX: 0, beamArc: -1, energy: 0, release: 0, beat: -1 }),
    []
  );

  // fov follows orientation; set on change, never per frame.
  useEffect(() => {
    camera.fov = portrait ? 58 : 42;
    camera.updateProjectionMatrix();
  }, [camera, portrait]);

  const fire = (origin: number[]) => {
    downbeatId.current++;
    clock.current = 0;
    beatT.current = 0;
    waveOrigin.current = origin;
  };

  useFrame((state, dt) => {
    const c = conductor.current;
    const d = Math.min(dt, 1 / 30);

    // 1 — inputs
    decayPointer(d);
    c.time = state.clock.elapsedTime;

    // 2 — arrival clock; scrolling during arrival runs it at 4x
    arrivalT.current += d * arrivalRate(progress.current, arrivalT.current);

    // 3 — scroll pursuit; the scrollbar itself is never touched
    smoothP.current = damp(smoothP.current, progress.current, 6, d);
    const p = smoothP.current;
    c.p = p;
    const cutoff = cutoffLatch(prevCutoff.current, p);

    // 4 — events
    if (!firedFirst.current && arrivalT.current >= ARRIVAL.ictus) {
      fire([0, SEAT_Y, 0]);
      firedFirst.current = true;
    }
    if (tapPending.current) {
      const tap = tapPending.current;
      tapPending.current = null;
      if (prevAim.current >= 0.5 && !cutoff) {
        v.set(tap.nx, -tap.ny, 0.5).unproject(camera);
        camera.getWorldPosition(eye);
        dir.copy(v).sub(eye).normalize();
        eyeArr[0] = eye.x; eyeArr[1] = eye.y; eyeArr[2] = eye.z;
        dirArr[0] = dir.x; dirArr[1] = dir.y; dirArr[2] = dir.z;
        fire(stageHit(eyeArr, dirArr));
      }
    }
    if (clock.current >= 0) {
      clock.current += d;
      beatT.current += d;
    }

    // 5 — camera: scroll owns the rig; the head adds a bounded look
    const r = cameraRig(p, portrait);
    headYaw.current = damp(headYaw.current, clamp(POINTER.orbitY, -0.44, 0.44), 5, d);
    headPitch.current = damp(headPitch.current, clamp(0.4 * POINTER.orbitX, -0.17, 0.17), 5, d);
    rig.current.position.set(0, r.y, r.z);
    rig.current.rotation.set(r.pitch + headPitch.current, r.yaw + headYaw.current, 0);
    rig.current.updateMatrixWorld(true);

    // 6 — stage hit: where the hand points, on the stage plane
    v.set(POINTER.nx, -POINTER.ny, 0.5).unproject(camera);
    camera.getWorldPosition(eye);
    dir.copy(v).sub(eye).normalize();
    eyeArr[0] = eye.x; eyeArr[1] = eye.y; eyeArr[2] = eye.z;
    dirArr[0] = dir.x; dirArr[1] = dir.y; dirArr[2] = dir.z;
    const hit = stageHit(eyeArr, dirArr);
    stageDamped.x = damp(stageDamped.x, hit[0], 7, d);
    stageDamped.y = damp(stageDamped.y, hit[1], 7, d);
    stageDamped.z = damp(stageDamped.z, hit[2], 7, d);
    const beamTarget = POINTER.active && !POINTER.down && !cutoff ? 1 : 0;
    beamStrength.current = damp(beamStrength.current, beamTarget, 8, d);
    c.eye[0] = eye.x; c.eye[1] = eye.y; c.eye[2] = eye.z;
    c.stage[0] = stageDamped.x; c.stage[1] = stageDamped.y; c.stage[2] = stageDamped.z;
    dir.copy(stageDamped).sub(eye).normalize();
    c.beamDir[0] = dir.x; c.beamDir[1] = dir.y; c.beamDir[2] = dir.z;
    c.beamStrength = beamStrength.current;

    // 7 — baton: a fixed hand that aims along the beam; never tethered to the cursor
    const pose = batonPose(arrivalT.current, beatT.current, p);
    pivotWorld.set(pose.x, pose.y, pose.z);
    rig.current.localToWorld(pivotWorld);
    aimWorld.copy(stageDamped).sub(pivotWorld).normalize();
    rig.current.getWorldQuaternion(rigQuat);
    aimLocal.copy(aimWorld).applyQuaternion(rigQuat.invert());
    dirLocal.set(
      lerp(pose.dir[0], aimLocal.x, pose.aim),
      lerp(pose.dir[1], aimLocal.y, pose.aim),
      lerp(pose.dir[2], aimLocal.z, pose.aim)
    ).normalize();
    q.setFromUnitVectors(Y_AXIS, dirLocal);
    qDip.setFromAxisAngle(X_AXIS, -0.2443 * pose.dip);
    baton.current.quaternion.copy(qDip.multiply(q));
    baton.current.position.set(pose.x, pose.y, pose.z);
    baton.current.scale.setScalar(Math.max(pose.present, 0.001));
    glowRef.current = lerp(1, 0.4, pose.rest);
    c.handoff = pose.aim;
    prevAim.current = pose.aim;

    // 8 — shared fields
    c.arrivalT = arrivalT.current;
    c.clock = clock.current;
    c.beatT = beatT.current;
    c.downbeatId = downbeatId.current;
    c.waveOrigin = waveOrigin.current;
    c.releaseR = releaseRadius(p);
    c.cutoff = cutoff;
    energy.current = damp(energy.current, POINTER.energy, 4, d);
    c.energy = energy.current;
    const hoverIdx = Number(document.documentElement.dataset.hoverThird ?? -1);
    for (let k = 0; k < 3; k++) {
      c.ember[k] = thirdEmber(p, k);
      c.lit[k] = thirdLit(p, k);
      hover.current[k] = damp(hover.current[k], k === hoverIdx ? 1 : 0, 6, d);
      c.hover[k] = hover.current[k];
    }
    c.copyMask = copyMaskNdc.current;
    c.hall = hallLight(p);
    c.portrait = portrait;
    c.lowPower = lowPower;

    // 9 — DOM, edge-triggered only
    const root = document.documentElement;
    const mv = p < 0.35 ? "1" : p < 0.7 ? "2" : "3";
    if (mv !== prevMv.current) { root.dataset.mv = mv; prevMv.current = mv; }
    let n = 0;
    for (let k = 0; k < 3; k++) if (thirdLit(p, k) >= 0.5) n++;
    const cueStr = String(n);
    if (cueStr !== prevCue.current) { root.dataset.cue = cueStr; prevCue.current = cueStr; }
    if (!liveSet.current && pose.aim >= 0.5) { root.classList.add("baton-live"); liveSet.current = true; }
    if (cutoff !== prevCutoffClass.current) { root.classList.toggle("cutoff", cutoff); prevCutoffClass.current = cutoff; }

    // 10 — audio, if the visitor asked for it
    const a = audio.current;
    if (a) {
      const s = audioState;
      for (let i = 0; i < 5; i++) { s.lock[i] = c.lockByArc[i]; s.pulse[i] = c.pulseByArc[i]; }
      s.beam = beamStrength.current;
      s.beamX = clamp(stageDamped.x / 8, -1, 1);
      let arc = -1;
      if (beamStrength.current > 0.5) {
        const rr = Math.hypot(stageDamped.x, stageDamped.z);
        let best = Infinity;
        for (let i = 0; i < ARC_RADII.length; i++) {
          const e = Math.abs(ARC_RADII[i] - rr);
          if (e < best) { best = e; arc = i; }
        }
      }
      s.beamArc = arc;
      s.energy = c.energy;
      s.release = release(p);
      s.beat = beatT.current;
      a.setState(s);
    }

    prevCutoff.current = cutoff;
  });

  return (
    <group ref={rig} rotation-order="YXZ">
      <primitive object={camera} />
      <Baton ref={baton} glow={glowRef} />
    </group>
  );
}

/**
 * DEV-only test seam. The browsers available here run pages backgrounded, where
 * rAF is suspended and R3F never draws — so shaders never compile and a GLSL
 * error would be invisible. Compiling in an effect needs no frame; any shader
 * error lands in the console where it can be read. Stripped from production.
 */
function DevCompile() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    try {
      gl.compile(scene, camera);
      (window as unknown as { __compiled?: number }).__compiled = gl.info.programs?.length ?? 0;
    } catch (e) {
      console.error("[scene] compile failed", e);
    }
  }, [gl, scene, camera]);
  return null;
}

function useAllowed() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const reduced =
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      localStorage.getItem("amm:reduce-motion") === "1";
    if (reduced) return;
    if ((navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData) return;
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
  const conductor = useRef<Conductor>(newConductor());
  const [lowPower, setLowPower] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [on, setOn] = useState(false);
  const audio = useRef<AudioHandle | null>(null);
  const modPromise = useRef<Promise<typeof import("@lib/audio")> | null>(null);
  const tapPending = useRef<{ nx: number; ny: number } | null>(null);
  const copyMaskNdc = useRef<number[]>([-2, -2, -2, -2]);

  useEffect(() => {
    setLowPower(matchMedia("(pointer: coarse)").matches || (navigator.hardwareConcurrency ?? 8) <= 4);
    const mq = matchMedia("(orientation: portrait)");
    setPortrait(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setPortrait(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    return initPointer();
  }, [allowed]);

  // TAP = DOWNBEAT. Own passive listeners; pointer.ts stays untouched.
  useEffect(() => {
    if (!allowed) return;
    let rec: { x: number; y: number; t: number } | null = null;
    const down = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest("a, button, input, label, .sound")) return;
      rec = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const up = (e: PointerEvent) => {
      if (rec && performance.now() - rec.t < 250 && Math.hypot(e.clientX - rec.x, e.clientY - rec.y) < 8) {
        tapPending.current = { nx: (rec.x / innerWidth) * 2 - 1, ny: (rec.y / innerHeight) * 2 - 1 };
      }
      rec = null;
    };
    const cancel = () => { rec = null; };
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    window.addEventListener("pointercancel", cancel, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [allowed]);

  // COPY MASK: the scene dims under whichever copy block is most on screen.
  // Sampled on scroll/resize, never inside the frame loop.
  useEffect(() => {
    if (!allowed) return;
    const sample = () => {
      let best: DOMRect | null = null;
      let bestH = 0;
      document.querySelectorAll<HTMLElement>("[data-copy]").forEach((el) => {
        const r = el.getBoundingClientRect();
        const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
        if (h > bestH) { bestH = h; best = r; }
      });
      if (best && bestH > 40) {
        const b = best as DOMRect;
        copyMaskNdc.current = [
          (b.left / innerWidth) * 2 - 1,
          1 - (b.bottom / innerHeight) * 2,
          (b.right / innerWidth) * 2 - 1,
          1 - (b.top / innerHeight) * 2,
        ];
      } else {
        copyMaskNdc.current = [-2, -2, -2, -2];
      }
    };
    sample();
    const late = window.setTimeout(sample, 1000); // after fonts
    addEventListener("scroll", sample, { passive: true });
    addEventListener("resize", sample, { passive: true });
    return () => {
      clearTimeout(late);
      removeEventListener("scroll", sample);
      removeEventListener("resize", sample);
    };
  }, [allowed]);

  useEffect(() => () => { audio.current?.stop(); }, []);

  if (!allowed) return null;

  const prewarm = () => { modPromise.current ??= import("@lib/audio"); };
  const toggleSound = async () => {
    if (audio.current) {
      const h = audio.current;
      audio.current = null;
      setOn(false);
      await h.stop();
      return;
    }
    // Created synchronously inside the gesture; never autoplay, never remembered.
    const ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
    setOn(true);
    const mod = await (modPromise.current ??= import("@lib/audio"));
    audio.current = mod.startAudio(ctx);
  };

  return (
    <>
      <button
        type="button"
        className="sound mono"
        aria-pressed={on}
        onPointerEnter={prewarm}
        onFocus={prewarm}
        onClick={toggleSound}
      >
        SOUND · {on ? "ON" : "OFF"}
      </button>
      <Canvas
        dpr={[1, lowPower ? 1 : 1.75]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance", failIfMajorPerformanceCaveat: true }}
        camera={{ position: [0, 0, 0], rotation: [0, 0, 0], fov: portrait ? 58 : 42, near: 0.05, far: 80 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
          document.documentElement.classList.add("gl-active");
        }}
      >
        <Starfield count={lowPower ? 600 : 1400} />
        <Conduct
          conductor={conductor}
          progress={progress}
          portrait={portrait}
          lowPower={lowPower}
          audio={audio}
          tapPending={tapPending}
          copyMaskNdc={copyMaskNdc}
        />
        <Orchestra conductor={conductor} lowPower={lowPower} />
        {import.meta.env.DEV && <DevCompile />}

        {/* Small, intensely bright sources; for the shaft's specular only. */}
        <Environment resolution={128}>
          <Lightformer intensity={6} position={[2, 3, 4]} scale={[3, 1, 1]} />
          <Lightformer intensity={3} position={[-3, 1, 2]} scale={[2, 0.6, 1]} color="#bfe9ff" />
          <Lightformer intensity={2} position={[0, -3, 2]} scale={[4, 1, 1]} color="#ff9b50" />
          <Lightformer intensity={1.2} form="ring" position={[0, 0, -5]} scale={[7, 7, 1]} />
        </Environment>

        <EffectComposer enableNormalPass={false}>
          <Bloom intensity={0.7} luminanceThreshold={0.6} luminanceSmoothing={0.25} mipmapBlur />
          <Vignette eskil={false} offset={0.26} darkness={0.85} />
        </EffectComposer>
      </Canvas>
    </>
  );
}
