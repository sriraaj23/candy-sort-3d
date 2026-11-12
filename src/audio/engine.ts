import type { ThemeMusic } from '../game';

export type SoundName = 'select' | 'deselect' | 'drop' | 'invalid' | 'jarComplete' | 'levelComplete' | 'click' | 'coin' | 'hint' | 'pop';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/**
 * All audio is synthesised with the Web Audio API. The context is created on
 * the first user gesture (browsers block autoplay before that).
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private delay!: DelayNode;
  private noiseBuffer: AudioBuffer | null = null;
  private settings = { music: 0.5, sfx: 0.8, muted: false };
  private theme: ThemeMusic | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  private step = 0;
  private melodyIdx = 5;
  private musicEnabled = true;

  get unlocked() {
    return !!this.ctx;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 2400;
    this.musicBus = ctx.createGain();
    this.musicFilter.connect(this.musicBus);
    this.musicBus.connect(this.master);
    // Soft echo for the music.
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = 0.33;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.delay.connect(fb);
    fb.connect(this.delay);
    this.delay.connect(wet);
    wet.connect(this.musicBus);

    const len = Math.floor(ctx.sampleRate * 0.3);
    this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.applyVolumes();
    void ctx.resume();
    this.startMusic();
  }

  setVolumes(music: number, sfx: number, muted: boolean) {
    this.settings = { music, sfx, muted };
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const { music, sfx, muted } = this.settings;
    this.master.gain.setTargetAtTime(muted ? 0 : 1, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(sfx * 0.9, t, 0.03);
    this.musicBus.gain.setTargetAtTime(music * 0.32, t, 0.08);
  }

  setTheme(theme: ThemeMusic) {
    this.theme = theme;
    if (this.ctx) this.musicFilter.frequency.setTargetAtTime(2200 * theme.brightness, this.ctx.currentTime, 0.5);
  }

  /** Suspends everything when the tab is hidden. */
  setHidden(hidden: boolean) {
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  setMusicEnabled(on: boolean) {
    this.musicEnabled = on;
  }

  // ---------- sound effects ----------

  private tone(
    freq: number,
    start: number,
    dur: number,
    opts: { type?: OscillatorType; gain?: number; attack?: number; glide?: number; dest?: AudioNode | AudioNode[] } = {},
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (opts.glide) osc.frequency.exponentialRampToValueAtTime(opts.glide, start + dur * 0.8);
    const peak = opts.gain ?? 0.2;
    const atk = opts.attack ?? 0.006;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    const dests = opts.dest ? (Array.isArray(opts.dest) ? opts.dest : [opts.dest]) : [this.sfxBus];
    for (const d of dests) g.connect(d);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private noise(start: number, dur: number, freq: number, gain: number) {
    const ctx = this.ctx!;
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  private bell(freq: number, start: number, dur: number, gain: number) {
    this.tone(freq, start, dur, { gain, type: 'sine' });
    this.tone(freq * 2.01, start, dur * 0.6, { gain: gain * 0.35, type: 'sine' });
    this.tone(freq * 3.02, start, dur * 0.3, { gain: gain * 0.12, type: 'sine' });
  }

  play(name: SoundName) {
    if (!this.ctx || this.settings.muted || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + 0.005;
    switch (name) {
      case 'select':
        this.tone(620, t, 0.14, { glide: 940, gain: 0.18 });
        this.tone(1240, t, 0.08, { gain: 0.04, type: 'triangle' });
        break;
      case 'deselect':
        this.tone(820, t, 0.12, { glide: 560, gain: 0.13 });
        break;
      case 'drop':
        this.tone(520, t, 0.16, { glide: 300, gain: 0.2, type: 'triangle' });
        this.noise(t, 0.05, 2400, 0.12);
        break;
      case 'pop':
        this.tone(900, t, 0.08, { glide: 1400, gain: 0.12 });
        break;
      case 'invalid':
        this.tone(200, t, 0.1, { gain: 0.16, type: 'square', glide: 170 });
        this.tone(150, t + 0.1, 0.14, { gain: 0.16, type: 'square', glide: 120 });
        break;
      case 'jarComplete':
        [72, 76, 79, 84].forEach((n, i) => this.bell(midi(n), t + i * 0.07, 0.5, 0.13));
        this.noise(t + 0.25, 0.25, 6000, 0.05);
        break;
      case 'levelComplete':
        [67, 72, 76, 79].forEach((n, i) => this.bell(midi(n), t + i * 0.12, 0.45, 0.14));
        [72, 76, 79, 84].forEach((n) => this.tone(midi(n), t + 0.55, 1.2, { gain: 0.07, type: 'triangle', attack: 0.04 }));
        this.bell(midi(91), t + 0.6, 1.0, 0.06);
        break;
      case 'click':
        this.tone(1100, t, 0.05, { gain: 0.08, glide: 900 });
        break;
      case 'coin':
        this.tone(midi(83), t, 0.08, { gain: 0.09, type: 'square' });
        this.tone(midi(88), t + 0.07, 0.25, { gain: 0.09, type: 'square' });
        break;
      case 'hint':
        [79, 83, 86, 91].forEach((n, i) => this.tone(midi(n), t + i * 0.05, 0.25, { gain: 0.07 }));
        break;
    }
  }

  // ---------- generative music ----------

  private startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.nextStepTime = this.ctx.currentTime + 0.3;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 60);
  }

  private scheduleMusic() {
    const ctx = this.ctx;
    const theme = this.theme;
    if (!ctx || !theme || ctx.state !== 'running') return;
    const stepDur = 60 / theme.bpm / 2; // eighth notes
    while (this.nextStepTime < ctx.currentTime + 0.25) {
      if (this.musicEnabled && this.settings.music > 0) this.musicStep(this.nextStepTime, stepDur, theme);
      this.nextStepTime += stepDur;
      this.step++;
    }
  }

  private noteInScale(theme: ThemeMusic, idx: number) {
    const len = theme.scale.length;
    const octave = Math.floor(idx / len);
    const deg = ((idx % len) + len) % len;
    return theme.root + octave * 12 + theme.scale[deg];
  }

  private musicStep(t: number, stepDur: number, theme: ThemeMusic) {
    const bar = Math.floor(this.step / 8) % theme.progression.length;
    const inBar = this.step % 8;
    const chordRoot = theme.root - 12 + theme.progression[bar];
    const dest = this.musicFilter;
    if (inBar === 0) {
      // Pad chord + soft bass at the start of each bar.
      const third = theme.scale.includes(3) ? 3 : 4;
      [0, third, 7, 12].forEach((iv) =>
        this.tone(midi(chordRoot + iv), t, stepDur * 8.5, { type: theme.padWave, gain: 0.05, attack: 0.5, dest }),
      );
      this.tone(midi(chordRoot - 12), t, stepDur * 4, { type: 'sine', gain: 0.1, attack: 0.05, dest });
    }
    if (inBar === 4) this.tone(midi(chordRoot - 12 + 7), t, stepDur * 3, { type: 'sine', gain: 0.07, attack: 0.05, dest });
    // Sparse melody, a gentle random walk on the scale.
    const play = inBar % 2 === 0 ? Math.random() < 0.55 : Math.random() < 0.18;
    if (play) {
      this.melodyIdx += Math.round((Math.random() - 0.5) * 3.2);
      this.melodyIdx = Math.max(2, Math.min(11, this.melodyIdx));
      const n = this.noteInScale(theme, this.melodyIdx);
      this.tone(midi(n), t, stepDur * 1.8, { type: theme.wave, gain: 0.07, attack: 0.01, dest: [dest, this.delay] });
    }
  }
}

export const audio = new AudioEngine();
export const sfx = (name: SoundName) => audio.play(name);
