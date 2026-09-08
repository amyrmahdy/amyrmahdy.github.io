import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  seats,
  lock,
  wavefront,
  rebaseSeat,
  pulse,
  SEAT_Y,
  ARC_RADII,
  WAVE_SPEED,
  BPS,
  type Conductor,
} from "@lib/choreography";

/**
 * The players: one instanced quad per seat, a disc with a stroke rising out
 * of it. Everything about a seat's motion is decided on the GPU from three
 * dynamic attributes (distance from the wave origin, the lock it carried in,
 * the phase it carried in) plus the conductor's clock, so the CPU touches the
 * attributes only on a downbeat. The reflection in the floor is a second
 * InstancedMesh over the same geometry with y flipped in the vertex shader —
 * never a negative-scale group, never an object parented twice.
 *
 * All input arrives through the conductor. Nothing here reads the pointer.
 */

const VERT = /* glsl */ `
attribute float aArc;
attribute float aRadius;
attribute float aThird;
attribute float aTuneHz;
attribute float aTunePhase;
attribute float aSeed;
attribute float aDist;
attribute float aLockPrev;
attribute float aPhase0;

uniform float uTime;
uniform float uClock;
uniform float uReleaseR;
uniform vec3 uEye;
uniform vec3 uBeamDir;
uniform float uBeamStrength;
uniform vec3 uEmber;
uniform vec3 uLit;
uniform vec3 uHover;
uniform float uMirror;

varying vec2 vLocal;
varying vec3 vBase;
varying float vDistCam;
varying vec2 vNdc;
varying float vArrived;
varying float vBeat;
varying float vLocked;
varying float vTune;
varying float vBeam;
varying float vFlash;
varying float vReleased;
varying float vEmber;
varying float vLit;
varying float vHover;

#define SPEED 6.5
#define LOCK_W 0.6
#define BPS 1.2
#define TAIL 0.101469
#define COS_OUTER 0.987688
#define COS_INNER 0.997564

float pulse(float ph) {
  float f = fract(ph);
  return f < 0.12 ? TAIL + (1.0 - TAIL) * (f / 0.12) : exp(-(f - 0.12) * 2.6);
}

float lockf(float d, float r) {
  return r < 0.0 ? 0.0 : smoothstep(0.0, 1.0, clamp((r - d) / LOCK_W, 0.0, 1.0));
}

void main() {
  vec3 base = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

  // Cylindrical billboard in world space: face the camera about Y only.
  vec3 toCam = cameraPosition - base;
  toCam.y = 0.0;
  vec3 right = length(toCam) > 1e-4 ? normalize(cross(vec3(0.0, 1.0, 0.0), toCam)) : vec3(1.0, 0.0, 0.0);
  vec3 world = base + right * position.x + vec3(0.0, position.y, 0.0);
  if (uMirror > 0.5) world.y = -world.y;

  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);

  vLocal = position.xy;
  vBase = base;
  vDistCam = distance(world, cameraPosition);
  vNdc = gl_Position.xy / gl_Position.w;

  // Per-instance choreography, evaluated once per vertex rather than per pixel.
  vArrived = lockf(aDist, uClock < 0.0 ? -1.0 : uClock * SPEED);
  vBeat = mix(
    pulse(aPhase0 + max(0.0, uClock) * BPS) * aLockPrev,
    pulse((uClock - aDist / SPEED) * BPS),
    vArrived
  );
  vLocked = max(aLockPrev, vArrived);
  vTune = 0.5 + 0.5 * sin(6.2831853 * aTuneHz * uTime + aTunePhase);
  vBeam = smoothstep(COS_OUTER, COS_INNER, dot(normalize(base - uEye), uBeamDir)) * uBeamStrength;
  vFlash = uClock < 0.0 ? 0.0 : exp(-pow((aDist - uClock * SPEED) / 0.35, 2.0));
  vReleased = uReleaseR <= 0.0
    ? 0.0
    : smoothstep(0.0, 1.0, clamp((uReleaseR - aRadius) / LOCK_W, 0.0, 1.0));

  int k = int(aThird + 0.5);
  vEmber = uEmber[k];
  vLit = uLit[k];
  vHover = uHover[k];
}
`;

const FRAG = /* glsl */ `
precision highp float;

uniform float uEnergy;
uniform vec4 uCopyMask;
uniform float uMirror;
uniform float uHall;

varying vec2 vLocal;
varying vec3 vBase;
varying float vDistCam;
varying vec2 vNdc;
varying float vArrived;
varying float vBeat;
varying float vLocked;
varying float vTune;
varying float vBeam;
varying float vFlash;
varying float vReleased;
varying float vEmber;
varying float vLit;
varying float vHover;

#define ICE vec3(0.933, 0.976, 0.992)
#define EMBER vec3(1.0, 0.608, 0.314)

// Scene brightness under the copy column: 0.35 inside, 1 outside, feathered.
float maskEdge(float v, float lo, float hi) {
  const float feather = 0.08;
  return smoothstep(0.0, 1.0, clamp((v - lo + feather) / feather, 0.0, 1.0))
       * smoothstep(0.0, 1.0, clamp((hi - v + feather) / feather, 0.0, 1.0));
}

float copyMask(vec2 p) {
  float inside = maskEdge(p.x, uCopyMask.x, uCopyMask.z) * maskEdge(p.y, uCopyMask.y, uCopyMask.w);
  return 1.0 - 0.65 * inside;
}

void main() {
  float amp = mix(vTune, 0.25 + 0.75 * vBeat, vLocked)
            * (1.0 + 0.9 * vBeam)
            * (1.0 + 1.4 * uEnergy)
            * (1.0 + 0.6 * vLit)
            * (1.0 - vReleased);

  // The disc at the seat.
  float d = length(vLocal);
  float disc = smoothstep(0.06, 0.02, d);

  // The stroke rising out of it, its height the amplitude.
  float h = 0.5 * amp;
  float fw = fwidth(vLocal.x);
  float hw = max(0.006, 0.75 * fw);
  float stroke = (1.0 - smoothstep(hw, hw + fw, abs(vLocal.x)))
               * step(0.0, vLocal.y)
               * (1.0 - smoothstep(max(h - 0.02, 0.0), h, vLocal.y))
               * step(0.005, h);

  float L = (0.30 + 0.45 * amp + 0.55 * vBeam + 0.9 * vFlash + 0.25 * vLit + 0.3 * vHover)
          * copyMask(vNdc);

  vec3 col = mix(ICE, EMBER, vEmber);
  float value = (disc + 0.85 * stroke) * L;
  if (uMirror > 0.5) value *= 0.25 * (1.0 - smoothstep(6.0, 14.0, vDistCam));
  if (value < 0.004) discard;

  gl_FragColor = vec4(col * value, value);
}
`;

const ARCS = ARC_RADII.length;

export function Orchestra({
  conductor,
  lowPower,
}: {
  conductor: React.RefObject<Conductor>;
  lowPower: boolean;
}) {
  const players = useRef<THREE.InstancedMesh>(null!);
  const mirror = useRef<THREE.InstancedMesh>(null!);
  const floorMat = useRef<THREE.MeshStandardMaterial>(null!);

  const built = useMemo(() => {
    const list = seats(lowPower);
    const n = list.length;

    // ── geometry: local y spans −0.08..0.58, disc centre at (0,0) ──────────
    const geometry = new THREE.PlaneGeometry(0.24, 0.66);
    geometry.translate(0, 0.25, 0);

    const arc = new Float32Array(n);
    const radius = new Float32Array(n);
    const third = new Float32Array(n);
    const tuneHz = new Float32Array(n);
    const tunePhase = new Float32Array(n);
    const seed = new Float32Array(n);
    const dist = new Float32Array(n);
    const lockPrev = new Float32Array(n);
    const phase0 = new Float32Array(n);

    const arcCount = new Float32Array(ARCS);
    for (const s of list) {
      arc[s.i] = s.arc;
      radius[s.i] = ARC_RADII[s.arc];
      third[s.i] = s.third;
      tuneHz[s.i] = s.tuneHz;
      tunePhase[s.i] = s.tunePhase;
      seed[s.i] = s.seed;
      dist[s.i] = ARC_RADII[s.arc];
      lockPrev[s.i] = 0;
      phase0[s.i] = 0;
      arcCount[s.arc] += 1;
    }

    const attr = (a: Float32Array, dynamic = false) => {
      const b = new THREE.InstancedBufferAttribute(a, 1);
      if (dynamic) b.setUsage(THREE.DynamicDrawUsage);
      return b;
    };
    const aDist = attr(dist, true);
    const aLockPrev = attr(lockPrev, true);
    const aPhase0 = attr(phase0, true);

    geometry.setAttribute("aArc", attr(arc));
    geometry.setAttribute("aRadius", attr(radius));
    geometry.setAttribute("aThird", attr(third));
    geometry.setAttribute("aTuneHz", attr(tuneHz));
    geometry.setAttribute("aTunePhase", attr(tunePhase));
    geometry.setAttribute("aSeed", attr(seed));
    geometry.setAttribute("aDist", aDist);
    geometry.setAttribute("aLockPrev", aLockPrev);
    geometry.setAttribute("aPhase0", aPhase0);

    // ── uniforms: one set of {value} boxes shared by both materials ─────────
    const uniforms: Record<string, THREE.IUniform> = {
      uTime: { value: 0 },
      uClock: { value: -1 },
      uReleaseR: { value: 0 },
      uEye: { value: new THREE.Vector3() },
      uBeamDir: { value: new THREE.Vector3(0, 0, -1) },
      uBeamStrength: { value: 0 },
      uEnergy: { value: 0 },
      uEmber: { value: new THREE.Vector3() },
      uLit: { value: new THREE.Vector3() },
      uHover: { value: new THREE.Vector3() },
      uCopyMask: { value: new THREE.Vector4(-2, -2, -2, -2) },
      uMirror: { value: 0 },
      uHall: { value: 0 },
    };
    const mirrorUniforms: Record<string, THREE.IUniform> = {
      ...uniforms,
      uMirror: { value: 1 },
    };

    const materialOpts = {
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    };
    const material = new THREE.ShaderMaterial({ ...materialOpts, uniforms });
    material.toneMapped = false;
    const mirrorMaterial = new THREE.ShaderMaterial({
      ...materialOpts,
      uniforms: mirrorUniforms,
    });
    mirrorMaterial.toneMapped = false;

    return {
      list,
      n,
      geometry,
      material,
      mirrorMaterial,
      uniforms,
      dist,
      lockPrev,
      phase0,
      aDist,
      aLockPrev,
      aPhase0,
      arcCount,
      arcSum: new Float64Array(ARCS),
      matrix: new THREE.Matrix4(),
    };
  }, [lowPower]);

  // Translation-only instance matrices, identical on both meshes, set once.
  useLayoutEffect(() => {
    const { list, matrix } = built;
    const targets = [players.current, mirror.current];
    for (const mesh of targets) {
      if (!mesh) continue;
      for (const s of list) {
        matrix.makeTranslation(s.x, SEAT_Y, s.z);
        mesh.setMatrixAt(s.i, matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }, [built]);

  const seenId = useRef(-1);
  const prevClock = useRef(-1);

  useFrame(() => {
    const c = conductor.current;
    if (!c) return;
    const { list, n, uniforms, dist, lockPrev, phase0, aDist, aLockPrev, aPhase0, arcCount, arcSum } =
      built;

    // (a) A new downbeat: rebase every seat against the clock of the frame
    //     before, so the pulse it was showing carries on without a seam.
    if (c.downbeatId !== seenId.current) {
      const old = prevClock.current;
      for (let i = 0; i < n; i++) {
        const s = list[i];
        const next = rebaseSeat(
          s,
          { lockPrev: lockPrev[i], phase0: phase0[i], dist: dist[i] },
          old,
          c.waveOrigin
        );
        lockPrev[i] = next.lockPrev;
        phase0[i] = next.phase0;
        dist[i] = next.dist;
      }
      aDist.needsUpdate = true;
      aLockPrev.needsUpdate = true;
      aPhase0.needsUpdate = true;
      seenId.current = c.downbeatId;
    }
    prevClock.current = c.clock;

    // (b) Uniforms — the boxes are shared, so one write reaches both materials.
    uniforms.uTime.value = c.time;
    uniforms.uClock.value = c.clock;
    uniforms.uReleaseR.value = c.releaseR;
    (uniforms.uEye.value as THREE.Vector3).set(c.eye[0], c.eye[1], c.eye[2]);
    (uniforms.uBeamDir.value as THREE.Vector3).set(c.beamDir[0], c.beamDir[1], c.beamDir[2]);
    uniforms.uBeamStrength.value = c.beamStrength;
    uniforms.uEnergy.value = c.energy;
    (uniforms.uEmber.value as THREE.Vector3).set(c.ember[0], c.ember[1], c.ember[2]);
    (uniforms.uLit.value as THREE.Vector3).set(c.lit[0], c.lit[1], c.lit[2]);
    (uniforms.uHover.value as THREE.Vector3).set(c.hover[0], c.hover[1], c.hover[2]);
    (uniforms.uCopyMask.value as THREE.Vector4).set(
      c.copyMask[0],
      c.copyMask[1],
      c.copyMask[2],
      c.copyMask[3]
    );
    uniforms.uHall.value = c.hall;

    // (c) What the rest of the scene needs to know: how locked each arc is,
    //     and the pulse it is showing.
    const front = wavefront(c.clock);
    arcSum.fill(0);
    for (let i = 0; i < n; i++) {
      const l = lock(dist[i], front);
      arcSum[list[i].arc] += lockPrev[i] > l ? lockPrev[i] : l;
    }
    for (let a = 0; a < ARCS; a++) {
      const mean = arcCount[a] > 0 ? arcSum[a] / arcCount[a] : 0;
      c.lockByArc[a] = mean;
      c.pulseByArc[a] =
        c.clock < 0 ? 0 : pulse((c.clock - ARC_RADII[a] / WAVE_SPEED) * BPS) * mean;
    }

    // (d) The hall lights come up in the floor.
    if (floorMat.current) floorMat.current.emissiveIntensity = 0.7 * c.hall;
  });

  return (
    <group>
      <instancedMesh
        ref={players}
        args={[built.geometry, built.material, built.n]}
        frustumCulled={false}
      />
      {!lowPower && (
        <instancedMesh
          ref={mirror}
          args={[built.geometry, built.mirrorMaterial, built.n]}
          frustumCulled={false}
        />
      )}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial
          ref={floorMat}
          color="#05070a"
          roughness={0.55}
          metalness={0}
          emissive="#ff9b50"
          emissiveIntensity={0}
        />
      </mesh>
    </group>
  );
}
