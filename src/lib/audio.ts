/** Five detuned drone voices that lock into a chord as the arcs resolve. */
export interface AudioState {
  lock: number[];
  pulse: number[];
  beam: number;
  beamX: number;
  beamArc: number;
  energy: number;
  release: number;
  beat: number;
}

export interface AudioHandle {
  setState(s: AudioState): void;
  stop(): Promise<void>;
}

const TUNING_HZ = [110, 220, 220, 440, 440];
const RESOLVED_HZ = [110, 164.81, 220, 329.63, 493.88];
const OFFSET_CENTS = [6, -9, 11, -4, 13];
const LFO_HZ = [0.13, 0.17, 0.11, 0.21, 0.19];
const PAN = [-0.3, -0.15, 0, 0.15, 0.3];
const c01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function impulse(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 2.8);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp((-6.9 * i) / len);
  }
  return buf;
}

export function startAudio(ctx: AudioContext): AudioHandle {
  const live = () => ctx.state !== "closed";
  const last = new Map<AudioParam, number>();
  // Every write is a smooth setTargetAtTime; skipped when the target barely moved.
  const set = (p: AudioParam, v: number, tau: number, at = ctx.currentTime) => {
    if (!live()) return;
    const prev = last.get(p);
    if (prev !== undefined && Math.abs(prev - v) < 1e-3) return;
    last.set(p, v);
    try {
      p.setTargetAtTime(v, at, tau);
    } catch {}
  };

  const master = new GainNode(ctx, { gain: 0 });
  const comp = new DynamicsCompressorNode(ctx, {
    threshold: -18,
    knee: 6,
    ratio: 4,
    attack: 0.01,
    release: 0.25,
  });
  const lowpass = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 1200, Q: 0.7 });
  const dry = new GainNode(ctx, { gain: 0.6 });
  const wet = new GainNode(ctx, { gain: 0.4 });
  const conv = new ConvolverNode(ctx, { buffer: impulse(ctx) });
  lowpass.connect(dry).connect(comp);
  lowpass.connect(conv).connect(wet).connect(comp);
  comp.connect(master).connect(ctx.destination);

  const sources: AudioScheduledSourceNode[] = [];
  const voices = TUNING_HZ.map((hz, i) => {
    const sine = new OscillatorNode(ctx, { type: "sine", frequency: hz });
    const tri = new OscillatorNode(ctx, { type: "triangle", frequency: hz });
    const triGain = new GainNode(ctx, { gain: 0.126 });
    const lfo = new OscillatorNode(ctx, { type: "sine", frequency: LFO_HZ[i] });
    const lfoGain = new GainNode(ctx, { gain: 14 });
    const offset = new ConstantSourceNode(ctx, { offset: 1 });
    const offGain = new GainNode(ctx, { gain: OFFSET_CENTS[i] });
    const voiceGain = new GainNode(ctx, { gain: 0.75 });
    const panner = new StereoPannerNode(ctx, { pan: PAN[i] });
    lfo.connect(lfoGain);
    lfoGain.connect(sine.detune);
    lfoGain.connect(tri.detune);
    offset.connect(offGain);
    offGain.connect(sine.detune);
    offGain.connect(tri.detune);
    sine.connect(voiceGain);
    tri.connect(triGain).connect(voiceGain);
    voiceGain.connect(panner).connect(lowpass);
    sources.push(sine, tri, lfo, offset);
    return { sine, tri, lfoGain, offGain, voiceGain, panner };
  });

  const t0 = ctx.currentTime;
  for (const s of sources) s.start(t0);
  set(master.gain, 0.12, 0.4, t0);

  let prevBeat = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const setState = (s: AudioState) => {
    if (!live()) return;
    const t = ctx.currentTime;
    voices.forEach((v, i) => {
      const L = c01(s.lock[i] ?? 0);
      const P = c01(s.pulse[i] ?? 0);
      const on = i === s.beamArc;
      set(v.offGain.gain, OFFSET_CENTS[i] * (1 - L), 0.3, t);
      set(v.lfoGain.gain, 14 * (1 - L), 0.3, t);
      const f = TUNING_HZ[i] * Math.pow(RESOLVED_HZ[i] / TUNING_HZ[i], L);
      set(v.sine.frequency, f, 0.3, t);
      set(v.tri.frequency, f, 0.3, t);
      set(v.voiceGain.gain, (0.75 + 0.25 * P) * (on ? 1.26 : 1), 0.03, t);
      set(v.panner.pan, PAN[i] + (on ? s.beamX * 0.6 : 0), 0.15, t);
    });

    const target = 0.12 * (1 + 0.41 * c01(s.energy)) * (1 - c01(s.release));
    const downbeat = s.beat >= 0 && (prevBeat < 0 || s.beat < prevBeat);
    if (downbeat) {
      set(master.gain, target * 0.63, 0.02, t);
      set(master.gain, target, 0.08, t + 0.12);
    } else {
      set(master.gain, target, 0.15, t);
    }
    prevBeat = s.beat;

    if (s.release >= 0.999) {
      if (timer === undefined && ctx.state === "running") {
        timer = setTimeout(() => {
          timer = undefined;
          if (ctx.state === "running") ctx.suspend().catch(() => {});
        }, 3000);
      }
    } else {
      clearTimer();
      if (s.release < 0.5 && ctx.state === "suspended") ctx.resume().catch(() => {});
    }
  };

  const stop = async () => {
    clearTimer();
    if (!live()) return;
    try {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setTargetAtTime(0, t, 0.08);
    } catch {}
    await new Promise((r) => setTimeout(r, 350));
    for (const s of sources) {
      try {
        s.stop();
      } catch {}
    }
    if (live()) await ctx.close();
  };

  return { setState, stop };
}
