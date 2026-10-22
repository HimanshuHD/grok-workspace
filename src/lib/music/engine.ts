import { hitsAt } from "@/lib/music/patterns";
import { clampBpm, type InstrumentId, type PatternId, type ResolvedChord } from "@/lib/music/theory";

export type TransportSnap = {
  playing: boolean;
  engaged: boolean;
  counting: boolean;
  countBeat: number;
  slot: number;
  beat: number;
  progress: number;
  beats: number;
};

type Session = {
  bpm: number;
  pattern: PatternId;
  instrument: InstrumentId;
  loop: boolean;
  metronome: boolean;
  countIn: boolean;
  chords: ResolvedChord[];
};

type Mark = {
  time: number;
  eighthDur: number;
  counting: boolean;
  countBeat: number;
  slot: number;
  eighth: number;
  beats: number;
};

const IDLE: TransportSnap = {
  playing: false,
  engaged: false,
  counting: false,
  countBeat: 0,
  slot: 0,
  beat: 0,
  progress: 0,
  beats: 4,
};

function emptySession(): Session {
  return {
    bpm: 96,
    pattern: "folk",
    instrument: "guitar",
    loop: true,
    metronome: false,
    countIn: false,
    chords: [],
  };
}

export class Engine {
  private ctx: AudioContext | null = null;
  private comp: DynamicsCompressorNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer = 0;
  private nextTime = 0;
  private countLeft = 0;
  private stopAt: number | null = null;
  private playing = false;
  private engaged = false;
  private cursor = { slot: 0, eighth: 0 };
  private rest = { slot: 0, beat: 0, beats: 4 };
  private marks: Mark[] = [];
  private alive: { end: number; stop: (time: number) => void }[] = [];
  session: Session = emptySession();

  isPlaying() {
    return this.playing;
  }

  setSession(session: Session) {
    const previous = this.session.chords;
    const prevId = previous[this.cursor.slot]?.id;
    const prevRest = previous[this.rest.slot]?.id;
    this.session = session;
    const sameSlot = !!prevId && session.chords[this.cursor.slot]?.id === prevId;
    if (!sameSlot && prevId) {
      const index = session.chords.findIndex((chord) => chord.id === prevId);
      if (index >= 0) this.cursor.slot = index;
    }
    if (this.cursor.slot >= session.chords.length) {
      this.cursor.slot = 0;
      this.cursor.eighth = 0;
    }
    const beats = session.chords[this.cursor.slot]?.beats ?? 4;
    if (this.cursor.eighth >= beats * 2) this.cursor.eighth = 0;
    const sameRest = !!prevRest && session.chords[this.rest.slot]?.id === prevRest;
    if (!sameRest && prevRest) {
      const index = session.chords.findIndex((chord) => chord.id === prevRest);
      if (index >= 0) this.rest.slot = index;
    }
    if (this.rest.slot >= session.chords.length) this.rest.slot = 0;
  }

  visual(): TransportSnap {
    if (!this.playing || !this.ctx) {
      if (!this.engaged) return IDLE;
      return {
        playing: false,
        engaged: true,
        counting: false,
        countBeat: 0,
        slot: this.rest.slot,
        beat: this.rest.beat,
        progress: 0,
        beats: this.rest.beats,
      };
    }
    const now = this.ctx.currentTime;
    let mark: Mark | null = null;
    for (const candidate of this.marks) {
      if (candidate.time <= now) mark = candidate;
    }
    if (!mark) {
      return {
        playing: true,
        engaged: true,
        counting: this.countLeft > 0,
        countBeat: 0,
        slot: this.cursor.slot,
        beat: 0,
        progress: 0,
        beats: this.session.chords[this.cursor.slot]?.beats ?? 4,
      };
    }
    const ratio = mark.eighthDur > 0 ? Math.min(1, Math.max(0, (now - mark.time) / mark.eighthDur)) : 0;
    const position = mark.eighth + ratio;
    const progress = mark.counting || mark.beats <= 0 ? 0 : Math.min(1, position / (mark.beats * 2));
    const beat = mark.counting ? 0 : Math.min(mark.beats - 1, Math.max(0, Math.floor(position / 2)));
    return {
      playing: true,
      engaged: true,
      counting: mark.counting,
      countBeat: mark.countBeat,
      slot: mark.slot,
      beat,
      progress,
      beats: mark.beats,
    };
  }

  async toggle() {
    if (this.playing) this.pause();
    else await this.start();
  }

  async start() {
    this.ensure();
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === "suspended") await ctx.resume();
    this.silence(ctx.currentTime);
    const fromTop = this.cursor.slot === 0 && this.cursor.eighth === 0 && !this.engaged;
    this.playing = true;
    this.engaged = true;
    this.stopAt = null;
    this.countLeft = fromTop && this.session.countIn ? 8 : 0;
    this.nextTime = ctx.currentTime + 0.05;
    this.schedule();
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  pause() {
    if (!this.ctx) {
      this.playing = false;
      return;
    }
    const now = this.ctx.currentTime;
    const audible = [...this.marks].reverse().find((mark) => mark.time <= now);
    this.playing = false;
    window.clearInterval(this.timer);
    this.silence(now);
    this.marks = [];
    this.stopAt = null;
    if (!audible || audible.counting) {
      this.resetCursor();
      return;
    }
    this.engaged = true;
    this.rest = {
      slot: audible.slot,
      beat: Math.min(audible.beats - 1, Math.max(0, Math.floor(audible.eighth / 2))),
      beats: audible.beats,
    };
    const total = audible.beats * 2;
    const nextEighth = audible.eighth + 1;
    if (nextEighth >= total) {
      const chords = this.session.chords;
      const nextSlot = audible.slot + 1 >= chords.length ? 0 : audible.slot + 1;
      if (audible.slot + 1 >= chords.length && !this.session.loop) this.resetCursor();
      else this.cursor = { slot: nextSlot, eighth: 0 };
    } else {
      this.cursor = { slot: audible.slot, eighth: nextEighth };
    }
  }

  reset() {
    if (this.ctx) this.silence(this.ctx.currentTime);
    this.playing = false;
    window.clearInterval(this.timer);
    this.marks = [];
    this.stopAt = null;
    this.resetCursor();
  }

  async preview(chord: ResolvedChord) {
    if (this.playing) return;
    this.ensure();
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === "suspended") await ctx.resume();
    this.silence(ctx.currentTime);
    const eighthDur = 60 / clampBpm(this.session.bpm) / 2;
    const eighths = Math.min(chord.beats * 2, 8);
    const start = ctx.currentTime + 0.02;
    for (let eighth = 0; eighth < eighths; eighth += 1) {
      this.playEighth(chord, eighth, start + eighth * eighthDur, eighthDur, eighths - eighth);
    }
  }

  private resetCursor() {
    this.engaged = false;
    this.cursor = { slot: 0, eighth: 0 };
    this.countLeft = 0;
    this.rest = { slot: 0, beat: 0, beats: this.session.chords[0]?.beats ?? 4 };
  }

  private ensure() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.16;
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 50;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    comp.connect(highpass);
    highpass.connect(master);
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.comp = comp;
    this.noise = makeNoise(ctx);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    let guard = 0;
    while (this.nextTime < ctx.currentTime + 0.14 && guard < 48) {
      guard += 1;
      const eighthDur = 60 / clampBpm(this.session.bpm) / 2;
      if (this.countLeft > 0) {
        const done = 8 - this.countLeft;
        const beat = Math.floor(done / 2) + 1;
        if (done % 2 === 0) this.click(this.nextTime, beat === 1);
        this.marks.push({
          time: this.nextTime,
          eighthDur,
          counting: true,
          countBeat: beat,
          slot: 0,
          eighth: 0,
          beats: this.session.chords[0]?.beats ?? 4,
        });
        this.countLeft -= 1;
        this.nextTime += eighthDur;
        continue;
      }
      const chords = this.session.chords;
      if (!chords.length) {
        this.reset();
        return;
      }
      if (this.cursor.slot >= chords.length) this.cursor.slot = 0;
      const chord = chords[this.cursor.slot];
      if (!chord) break;
      const total = chord.beats * 2;
      if (this.cursor.eighth >= total) this.cursor.eighth = 0;
      this.playEighth(chord, this.cursor.eighth, this.nextTime, eighthDur, total - this.cursor.eighth);
      if (this.session.metronome && this.cursor.eighth % 2 === 0) {
        this.click(this.nextTime, this.cursor.slot === 0 && this.cursor.eighth === 0);
      }
      this.marks.push({
        time: this.nextTime,
        eighthDur,
        counting: false,
        countBeat: 0,
        slot: this.cursor.slot,
        eighth: this.cursor.eighth,
        beats: chord.beats,
      });
      const lastEighth = this.cursor.eighth + 1 >= total;
      const lastSlot = this.cursor.slot + 1 >= chords.length;
      this.nextTime += eighthDur;
      if (lastEighth && lastSlot && !this.session.loop) {
        this.stopAt = this.nextTime;
        this.cursor = { slot: 0, eighth: 0 };
        break;
      }
      if (lastEighth) {
        this.cursor.eighth = 0;
        this.cursor.slot = lastSlot ? 0 : this.cursor.slot + 1;
      } else {
        this.cursor.eighth += 1;
      }
    }
    const now = ctx.currentTime;
    this.marks = this.marks.filter((mark) => mark.time > now - 2);
    if (this.stopAt !== null && now >= this.stopAt) this.reset();
  }

  private playEighth(chord: ResolvedChord, eighth: number, time: number, eighthDur: number, remaining: number) {
    const hits = hitsAt(this.session.pattern, eighth, chord.midi.length);
    const stagger = this.session.instrument === "guitar" ? 0.016 : 0.004;
    for (const hit of hits) {
      const dur = Math.max(0.07, Math.min(hit.holdEighths, Math.max(1, remaining)) * eighthDur * 0.96);
      const ordered = hit.stagger === "up" ? [...hit.voices].reverse() : hit.voices;
      ordered.forEach((voice, index) => {
        const midi = chord.midi[voice];
        if (midi === undefined) return;
        const when = time + (hit.stagger === "none" ? 0 : index * stagger);
        const velocity = Math.max(0.08, hit.velocity * (1 - index * 0.06));
        this.tone(midi, when, dur, velocity);
      });
    }
  }

  private tone(midi: number, time: number, dur: number, velocity: number) {
    const ctx = this.ctx;
    const comp = this.comp;
    if (!ctx || !comp) return;
    const freq = 440 * 2 ** ((midi - 69) / 12);
    const guitar = this.session.instrument === "guitar";
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc.type = guitar ? "triangle" : "sine";
    osc2.type = "sine";
    osc.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq * (guitar ? 2 : 1), time);
    osc.detune.setValueAtTime((midi % 5) - 2, time);
    osc2.detune.setValueAtTime(guitar ? -6 : 7, time);
    const body = ctx.createGain();
    const shimmer = ctx.createGain();
    body.gain.value = guitar ? 0.78 : 0.86;
    shimmer.gain.value = guitar ? 0.16 : 0.22;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    const open = guitar ? 800 + velocity * 3200 : 1200 + velocity * 1600;
    filter.frequency.setValueAtTime(open, time);
    filter.frequency.exponentialRampToValueAtTime(guitar ? 480 : 900, time + Math.min(0.35, Math.max(0.08, dur)));
    filter.Q.value = guitar ? 0.7 : 0.35;
    osc.connect(body);
    osc2.connect(shimmer);
    body.connect(filter);
    shimmer.connect(filter);
    if (guitar && this.noise) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noise;
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.setValueAtTime(Math.max(120, freq * 1.5), time);
      band.Q.value = 1.4;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(velocity * 0.22, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
      noise.connect(band);
      band.connect(noiseGain);
      noiseGain.connect(filter);
      noise.start(time);
      noise.stop(time + 0.06);
    }
    const amp = ctx.createGain();
    filter.connect(amp);
    amp.connect(comp);
    const level = (guitar ? 0.15 : 0.12) * velocity * (midi < 48 ? 0.72 : 1);
    const attack = guitar ? 0.004 : 0.014;
    const release = Math.max(attack + 0.06, dur);
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), time + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + release);
    osc.start(time);
    osc2.start(time);
    const end = time + release + 0.02;
    osc.stop(end);
    osc2.stop(end);
    this.alive = this.alive.filter((voice) => voice.end > time);
    this.alive.push({
      end,
      stop: (at: number) => {
        const stopAt = Math.max(at + 0.03, time + 0.02);
        try {
          amp.gain.cancelScheduledValues(at);
          amp.gain.setValueAtTime(Math.max(amp.gain.value, 0.0001), at);
          amp.gain.exponentialRampToValueAtTime(0.0001, stopAt);
          osc.stop(stopAt);
          osc2.stop(stopAt);
        } catch {
          /* already stopped */
        }
      },
    });
  }

  private click(time: number, accent: boolean) {
    const ctx = this.ctx;
    const comp = this.comp;
    if (!ctx || !comp) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(accent ? 1480 : 980, time);
    amp.gain.setValueAtTime(accent ? 0.06 : 0.035, time);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    osc.connect(amp);
    amp.connect(comp);
    osc.start(time);
    osc.stop(time + 0.05);
  }

  private silence(time: number) {
    for (const voice of this.alive) voice.stop(time);
    this.alive = [];
  }
}

function makeNoise(ctx: AudioContext) {
  const length = Math.floor(ctx.sampleRate * 0.2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
  return buffer;
}

export const engine = new Engine();
