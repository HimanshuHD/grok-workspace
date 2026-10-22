export type Quality =
  | "maj"
  | "min"
  | "dim"
  | "aug"
  | "sus2"
  | "sus4"
  | "7"
  | "maj7"
  | "min7"
  | "m7b5";

export type ModeId =
  | "major"
  | "dorian"
  | "phrygian"
  | "lydian"
  | "mixolydian"
  | "minor"
  | "harmonic"
  | "melodic";

export type InstrumentId = "guitar" | "keys";

export type PatternId =
  | "strum"
  | "folk"
  | "finger"
  | "arpup"
  | "arpdown"
  | "pulse"
  | "offbeat"
  | "waltz"
  | "sustain";

export type ChordSpec = {
  id: string;
  semitones: number;
  quality: Quality;
  beats: number;
};

export type ResolvedChord = ChordSpec & {
  symbol: string;
  roman: string;
  notes: string[];
  midi: number[];
  pitchClass: number;
};

const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const FLAT_MAJOR = new Set([1, 3, 5, 6, 8, 10]);

const INTERVALS: Record<Quality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
};

export const MODES: { id: ModeId; name: string; intervals: number[]; triad: Quality[] }[] = [
  {
    id: "major",
    name: "Major",
    intervals: [0, 2, 4, 5, 7, 9, 11],
    triad: ["maj", "min", "min", "maj", "maj", "min", "dim"],
  },
  {
    id: "dorian",
    name: "Dorian",
    intervals: [0, 2, 3, 5, 7, 9, 10],
    triad: ["min", "min", "maj", "maj", "min", "dim", "maj"],
  },
  {
    id: "phrygian",
    name: "Phrygian",
    intervals: [0, 1, 3, 5, 7, 8, 10],
    triad: ["min", "maj", "maj", "min", "dim", "maj", "min"],
  },
  {
    id: "lydian",
    name: "Lydian",
    intervals: [0, 2, 4, 6, 7, 9, 11],
    triad: ["maj", "maj", "min", "dim", "maj", "min", "min"],
  },
  {
    id: "mixolydian",
    name: "Mixolydian",
    intervals: [0, 2, 4, 5, 7, 9, 10],
    triad: ["maj", "min", "dim", "maj", "min", "min", "maj"],
  },
  {
    id: "minor",
    name: "Natural minor",
    intervals: [0, 2, 3, 5, 7, 8, 10],
    triad: ["min", "dim", "maj", "min", "min", "maj", "maj"],
  },
  {
    id: "harmonic",
    name: "Harmonic minor",
    intervals: [0, 2, 3, 5, 7, 8, 11],
    triad: ["min", "dim", "aug", "min", "maj", "maj", "dim"],
  },
  {
    id: "melodic",
    name: "Melodic minor",
    intervals: [0, 2, 3, 5, 7, 9, 11],
    triad: ["min", "min", "aug", "maj", "maj", "dim", "dim"],
  },
];

export const QUALITY_OPTIONS: { id: Quality; label: string }[] = [
  { id: "maj", label: "Maj" },
  { id: "min", label: "min" },
  { id: "7", label: "7" },
  { id: "maj7", label: "maj7" },
  { id: "min7", label: "m7" },
  { id: "sus4", label: "sus4" },
  { id: "sus2", label: "sus2" },
  { id: "dim", label: "dim" },
  { id: "aug", label: "aug" },
  { id: "m7b5", label: "m7♭5" },
];

export const BEAT_OPTIONS = [1, 2, 3, 4, 6, 8] as const;

export const PATTERNS: { id: PatternId; name: string; blurb: string }[] = [
  { id: "folk", name: "Folk strum", blurb: "Down, down-up, up-down-up across the bar." },
  { id: "strum", name: "Downstrum", blurb: "One downstroke on every beat." },
  { id: "finger", name: "Fingerpick", blurb: "Alternating bass with a treble pattern." },
  { id: "arpup", name: "Arpeggio up", blurb: "Chord tones climbing, one note at a time." },
  { id: "arpdown", name: "Arpeggio down", blurb: "Chord tones falling, one note at a time." },
  { id: "pulse", name: "Pulse", blurb: "The whole chord together on each beat." },
  { id: "offbeat", name: "Offbeat", blurb: "Short strums on the and of each beat." },
  {
    id: "waltz",
    name: "Waltz",
    blurb: "Bass on one, chords on two and three. Try 3 or 6 beats.",
  },
  { id: "sustain", name: "Sustain", blurb: "One bloom, held for the whole chord." },
];

const BORROWED: { semitones: number; quality: Quality }[] = [
  { semitones: 1, quality: "maj" },
  { semitones: 3, quality: "maj" },
  { semitones: 5, quality: "min" },
  { semitones: 8, quality: "maj" },
  { semitones: 9, quality: "maj" },
  { semitones: 10, quality: "maj" },
];

export type Preset = {
  id: string;
  name: string;
  hint: string;
  chords: { semitones: number; quality: Quality; beats: number }[];
};

const I7 = { semitones: 0, quality: "7" as const, beats: 4 };
const IV7 = { semitones: 5, quality: "7" as const, beats: 4 };
const V7 = { semitones: 7, quality: "7" as const, beats: 4 };

export const PRESETS: Preset[] = [
  {
    id: "axis",
    name: "Axis",
    hint: "I–V–vi–IV",
    chords: [
      { semitones: 0, quality: "maj", beats: 4 },
      { semitones: 7, quality: "maj", beats: 4 },
      { semitones: 9, quality: "min", beats: 4 },
      { semitones: 5, quality: "maj", beats: 4 },
    ],
  },
  {
    id: "fifties",
    name: "50s",
    hint: "I–vi–IV–V",
    chords: [
      { semitones: 0, quality: "maj", beats: 4 },
      { semitones: 9, quality: "min", beats: 4 },
      { semitones: 5, quality: "maj", beats: 4 },
      { semitones: 7, quality: "maj", beats: 4 },
    ],
  },
  {
    id: "sensitive",
    name: "Sensitive",
    hint: "vi–IV–I–V",
    chords: [
      { semitones: 9, quality: "min", beats: 4 },
      { semitones: 5, quality: "maj", beats: 4 },
      { semitones: 0, quality: "maj", beats: 4 },
      { semitones: 7, quality: "maj", beats: 4 },
    ],
  },
  {
    id: "doowop",
    name: "Doo-wop",
    hint: "I–vi–ii–V",
    chords: [
      { semitones: 0, quality: "maj", beats: 4 },
      { semitones: 9, quality: "min", beats: 4 },
      { semitones: 2, quality: "min", beats: 4 },
      { semitones: 7, quality: "maj", beats: 4 },
    ],
  },
  {
    id: "royal",
    name: "Royal road",
    hint: "IV–V–iii–vi",
    chords: [
      { semitones: 5, quality: "maj", beats: 4 },
      { semitones: 7, quality: "maj", beats: 4 },
      { semitones: 4, quality: "min", beats: 4 },
      { semitones: 9, quality: "min", beats: 4 },
    ],
  },
  {
    id: "ballad",
    name: "Ballad",
    hint: "I–iii–vi–IV",
    chords: [
      { semitones: 0, quality: "maj", beats: 4 },
      { semitones: 4, quality: "min", beats: 4 },
      { semitones: 9, quality: "min", beats: 4 },
      { semitones: 5, quality: "maj", beats: 4 },
    ],
  },
  {
    id: "creep",
    name: "Creep",
    hint: "I–III–IV–iv",
    chords: [
      { semitones: 0, quality: "maj", beats: 4 },
      { semitones: 4, quality: "maj", beats: 4 },
      { semitones: 5, quality: "maj", beats: 4 },
      { semitones: 5, quality: "min", beats: 4 },
    ],
  },
  {
    id: "mixo",
    name: "Mixolydian",
    hint: "I–♭VII–IV",
    chords: [
      { semitones: 0, quality: "maj", beats: 4 },
      { semitones: 10, quality: "maj", beats: 4 },
      { semitones: 5, quality: "maj", beats: 4 },
    ],
  },
  {
    id: "canon",
    name: "Canon",
    hint: "I–V–vi–iii–IV–I–IV–V",
    chords: [
      { semitones: 0, quality: "maj", beats: 2 },
      { semitones: 7, quality: "maj", beats: 2 },
      { semitones: 9, quality: "min", beats: 2 },
      { semitones: 4, quality: "min", beats: 2 },
      { semitones: 5, quality: "maj", beats: 2 },
      { semitones: 0, quality: "maj", beats: 2 },
      { semitones: 5, quality: "maj", beats: 2 },
      { semitones: 7, quality: "maj", beats: 2 },
    ],
  },
  {
    id: "twov",
    name: "ii–V–I",
    hint: "iim7–V7–Imaj7",
    chords: [
      { semitones: 2, quality: "min7", beats: 4 },
      { semitones: 7, quality: "7", beats: 4 },
      { semitones: 0, quality: "maj7", beats: 4 },
    ],
  },
  {
    id: "turn",
    name: "Turnaround",
    hint: "Imaj7–vim7–iim7–V7",
    chords: [
      { semitones: 0, quality: "maj7", beats: 4 },
      { semitones: 9, quality: "min7", beats: 4 },
      { semitones: 2, quality: "min7", beats: 4 },
      { semitones: 7, quality: "7", beats: 4 },
    ],
  },
  {
    id: "andalusian",
    name: "Andalusian",
    hint: "i–♭VII–♭VI–V",
    chords: [
      { semitones: 0, quality: "min", beats: 4 },
      { semitones: 10, quality: "maj", beats: 4 },
      { semitones: 8, quality: "maj", beats: 4 },
      { semitones: 7, quality: "maj", beats: 4 },
    ],
  },
  {
    id: "minorpop",
    name: "Minor pop",
    hint: "i–♭VI–♭III–♭VII",
    chords: [
      { semitones: 0, quality: "min", beats: 4 },
      { semitones: 8, quality: "maj", beats: 4 },
      { semitones: 3, quality: "maj", beats: 4 },
      { semitones: 10, quality: "maj", beats: 4 },
    ],
  },
  {
    id: "epic",
    name: "Epic minor",
    hint: "i–iv–♭VI–♭VII",
    chords: [
      { semitones: 0, quality: "min", beats: 4 },
      { semitones: 5, quality: "min", beats: 4 },
      { semitones: 8, quality: "maj", beats: 4 },
      { semitones: 10, quality: "maj", beats: 4 },
    ],
  },
  {
    id: "rock",
    name: "Three chord",
    hint: "I–IV–V–I",
    chords: [
      { semitones: 0, quality: "maj", beats: 4 },
      { semitones: 5, quality: "maj", beats: 4 },
      { semitones: 7, quality: "maj", beats: 4 },
      { semitones: 0, quality: "maj", beats: 4 },
    ],
  },
  {
    id: "blues",
    name: "12-bar blues",
    hint: "I7–IV7–V7",
    chords: [I7, I7, I7, I7, IV7, IV7, I7, I7, V7, IV7, I7, V7],
  },
];

export function modeById(id: ModeId) {
  return MODES.find((mode) => mode.id === id) ?? MODES[0];
}

export function prefersFlats(root: number, mode: ModeId): boolean {
  let rel = ((root % 12) + 12) % 12;
  if (mode === "minor" || mode === "harmonic" || mode === "melodic") rel = (rel + 3) % 12;
  else if (mode === "dorian") rel = (rel + 10) % 12;
  else if (mode === "phrygian") rel = (rel + 8) % 12;
  else if (mode === "lydian") rel = (rel + 7) % 12;
  else if (mode === "mixolydian") rel = (rel + 5) % 12;
  return FLAT_MAJOR.has(rel);
}

export function prettify(name: string): string {
  return name.replace(/([A-G])b/g, "$1♭").replace(/([A-G])#/g, "$1♯");
}

function accidental(amount: number): string {
  if (amount === 0) return "";
  if (amount === 1) return "#";
  if (amount === -1) return "b";
  if (amount === 2) return "##";
  if (amount === -2) return "bb";
  return "";
}

function shiftAccidental(pc: number, natural: number): number {
  let acc = (pc - natural + 12) % 12;
  if (acc > 6) acc -= 12;
  return acc;
}

export function tonicRaw(root: number, mode: ModeId): string {
  const pc = ((root % 12) + 12) % 12;
  const spelled = prefersFlats(pc, mode) ? FLAT[pc] : SHARP[pc];
  return spelled ?? "C";
}

export function tonicName(root: number, mode: ModeId): string {
  return prettify(tonicRaw(root, mode));
}

export function keyLabel(root: number, mode: ModeId): string {
  const name = modeById(mode).name.toLowerCase();
  return `${tonicName(root, mode)} ${name}`;
}

function spellScale(root: number, mode: ModeId): string[] {
  const intervals = modeById(mode).intervals;
  const tonic = tonicRaw(root, mode);
  const letterIndex = LETTERS.indexOf(tonic[0] ?? "C");
  const rootPc = ((root % 12) + 12) % 12;
  return intervals.map((interval, degree) => {
    const letter = LETTERS[(letterIndex + degree) % 7] ?? "C";
    const pc = (rootPc + interval) % 12;
    const natural = NATURAL[LETTERS.indexOf(letter)] ?? 0;
    return letter + accidental(shiftAccidental(pc, natural));
  });
}

export function scaleNotes(root: number, mode: ModeId): string[] {
  return spellScale(root, mode).map(prettify);
}

function spellRoot(keyRoot: number, semitones: number, mode: ModeId): string {
  const offset = ((semitones % 12) + 12) % 12;
  const intervals = modeById(mode).intervals;
  const degree = intervals.indexOf(offset);
  if (degree >= 0) return spellScale(keyRoot, mode)[degree] ?? tonicRaw(keyRoot, mode);
  const pc = (((keyRoot % 12) + 12) % 12 + offset) % 12;
  const flatSide = new Set([1, 3, 8, 10]);
  if (flatSide.has(offset) || (prefersFlats(keyRoot, mode) && offset !== 6)) return FLAT[pc] ?? "C";
  return SHARP[pc] ?? "C";
}

function suffix(quality: Quality): string {
  switch (quality) {
    case "maj":
      return "";
    case "min":
      return "m";
    case "dim":
      return "°";
    case "aug":
      return "+";
    case "sus2":
      return "sus2";
    case "sus4":
      return "sus4";
    case "7":
      return "7";
    case "maj7":
      return "maj7";
    case "min7":
      return "m7";
    case "m7b5":
      return "m7♭5";
  }
}

function romanSuffix(quality: Quality): string {
  switch (quality) {
    case "7":
      return "7";
    case "maj7":
      return "maj7";
    case "min7":
      return "7";
    case "m7b5":
      return "7";
    case "sus2":
      return "sus2";
    case "sus4":
      return "sus4";
    default:
      return "";
  }
}

function spellRoman(semitones: number, quality: Quality, mode: ModeId): string {
  const offset = ((semitones % 12) + 12) % 12;
  const intervals = modeById(mode).intervals;
  let degree = intervals.indexOf(offset);
  let acc = "";
  if (degree < 0) {
    const up = intervals.indexOf((offset + 1) % 12);
    const down = intervals.indexOf((offset + 11) % 12);
    const flatSide = new Set([1, 3, 8, 10]);
    if (flatSide.has(offset) && up >= 0) {
      degree = up;
      acc = "♭";
    } else if (down >= 0) {
      degree = down;
      acc = "♯";
    } else if (up >= 0) {
      degree = up;
      acc = "♭";
    } else {
      degree = 0;
    }
  }
  let numeral = ROMAN[degree] ?? "I";
  const minorish = quality === "min" || quality === "dim" || quality === "min7" || quality === "m7b5";
  if (minorish) numeral = numeral.toLowerCase();
  if (quality === "dim" || quality === "m7b5") numeral += "°";
  if (quality === "aug") numeral += "+";
  return acc + numeral + romanSuffix(quality);
}

function spellTones(rootRaw: string, quality: Quality): string[] {
  const rootLetter = rootRaw[0] ?? "C";
  const rootPc = pcOf(rootRaw);
  const start = Math.max(0, LETTERS.indexOf(rootLetter));
  const intervals = INTERVALS[quality];
  return intervals.map((interval, index) => {
    const letterSteps =
      quality === "sus2" ? [0, 1, 4][index] ?? 0 : quality === "sus4" ? [0, 3, 4][index] ?? 0 : index * 2;
    const letter = LETTERS[(start + letterSteps) % 7] ?? "C";
    const pc = (rootPc + interval) % 12;
    const natural = NATURAL[LETTERS.indexOf(letter)] ?? 0;
    return letter + accidental(shiftAccidental(pc, natural));
  });
}

function pcOf(raw: string): number {
  const pretty = raw;
  const letter = pretty[0] ?? "C";
  const base = NATURAL[LETTERS.indexOf(letter)] ?? 0;
  const rest = pretty.slice(1);
  const acc = rest.startsWith("##") ? 2 : rest.startsWith("bb") ? -2 : rest.startsWith("#") ? 1 : rest.startsWith("b") ? -1 : 0;
  return (base + acc + 12) % 12;
}

export function voiceMidi(pitchClass: number, quality: Quality, instrument: InstrumentId): number[] {
  const iv = INTERVALS[quality];
  const pc = ((pitchClass % 12) + 12) % 12;
  if (instrument === "keys") {
    const bass = 36 + pc;
    const fifth = bass + (iv[2] ?? 7);
    const rh = iv.map((interval) => 60 + pc + interval);
    return [bass, fifth, ...rh];
  }
  let bass = 40 + ((pc - 4 + 12) % 12);
  const notes = [bass];
  const fifthPc = (pc + (iv[2] ?? 7)) % 12;
  let cursor = bass + 1;
  while (cursor % 12 !== fifthPc) cursor += 1;
  notes.push(cursor);
  let octave = cursor + 1;
  while (octave % 12 !== pc) octave += 1;
  notes.push(octave);
  const colorPc = (pc + (iv[1] ?? 4)) % 12;
  let color = octave + 1;
  while (color % 12 !== colorPc) color += 1;
  notes.push(color);
  if (iv.length > 3) {
    const seventhPc = (pc + (iv[3] ?? 10)) % 12;
    let seventh = color + 1;
    while (seventh % 12 !== seventhPc) seventh += 1;
    notes.push(seventh);
  } else {
    let high = color + 1;
    while (high % 12 !== fifthPc) high += 1;
    if (high <= 84) notes.push(high);
  }
  return notes;
}

const QUALITY_SET = new Set<Quality>(QUALITY_OPTIONS.map((option) => option.id));

export function sanitizeChord(chord: ChordSpec, index: number): ChordSpec {
  const semitones = Number.isFinite(chord.semitones) ? ((Math.round(chord.semitones) % 12) + 12) % 12 : 0;
  const quality = QUALITY_SET.has(chord.quality) ? chord.quality : "maj";
  const beats = (BEAT_OPTIONS as readonly number[]).includes(chord.beats) ? chord.beats : 4;
  const id = typeof chord.id === "string" && chord.id ? chord.id : `chord-${index}`;
  return { id, semitones, quality, beats };
}

export function describeChord(
  chord: ChordSpec,
  keyRoot: number,
  mode: ModeId,
  instrument: InstrumentId = "guitar",
): ResolvedChord {
  const clean = sanitizeChord(chord, 0);
  const root = ((keyRoot % 12) + 12) % 12;
  const pitchClass = (root + clean.semitones) % 12;
  const raw = spellRoot(root, clean.semitones, mode);
  return {
    ...clean,
    pitchClass,
    symbol: prettify(raw + suffix(clean.quality)),
    roman: spellRoman(clean.semitones, clean.quality, mode),
    notes: spellTones(raw, clean.quality).map(prettify),
    midi: voiceMidi(pitchClass, clean.quality, instrument),
  };
}

export function resolveProgression(
  chords: ChordSpec[],
  keyRoot: number,
  mode: ModeId,
  instrument: InstrumentId,
): ResolvedChord[] {
  const list = (chords.length ? chords : [{ id: "empty", semitones: 0, quality: "maj" as const, beats: 4 }]).slice(0, 32);
  return list.map((chord, index) => describeChord({ ...chord, id: chord.id || `chord-${index}` }, keyRoot, mode, instrument));
}

export type DegreeChoice = {
  semitones: number;
  quality: Quality;
  symbol: string;
  roman: string;
};

export function diatonicChoices(keyRoot: number, mode: ModeId): DegreeChoice[] {
  const current = modeById(mode);
  return current.intervals.map((semitones, index) => {
    const quality = current.triad[index] ?? "maj";
    const described = describeChord({ id: "d", semitones, quality, beats: 4 }, keyRoot, mode);
    return { semitones, quality, symbol: described.symbol, roman: described.roman };
  });
}

export function borrowedChoices(keyRoot: number, mode: ModeId): DegreeChoice[] {
  const diatonic = diatonicChoices(keyRoot, mode);
  return BORROWED.flatMap((candidate) => {
    if (diatonic.some((chord) => chord.semitones === candidate.semitones && chord.quality === candidate.quality)) {
      return [];
    }
    const described = describeChord(
      { id: "b", semitones: candidate.semitones, quality: candidate.quality, beats: 4 },
      keyRoot,
      mode,
    );
    return [{ ...candidate, symbol: described.symbol, roman: described.roman }];
  });
}

export function sameChords(
  chords: { semitones: number; quality: Quality; beats: number }[],
  preset: { semitones: number; quality: Quality; beats: number }[],
): boolean {
  if (chords.length !== preset.length) return false;
  return chords.every(
    (chord, index) =>
      chord.semitones === preset[index]?.semitones &&
      chord.quality === preset[index]?.quality &&
      chord.beats === preset[index]?.beats,
  );
}

export function lengthLabel(totalBeats: number): string {
  if (totalBeats > 0 && totalBeats % 4 === 0) {
    const bars = totalBeats / 4;
    return `${totalBeats} beats · ${bars} ${bars === 1 ? "bar" : "bars"}`;
  }
  return `${totalBeats} ${totalBeats === 1 ? "beat" : "beats"}`;
}

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return 96;
  return Math.min(180, Math.max(50, Math.round(bpm)));
}

export function isModeId(value: unknown): value is ModeId {
  return MODES.some((mode) => mode.id === value);
}

export function isPatternId(value: unknown): value is PatternId {
  return PATTERNS.some((pattern) => pattern.id === value);
}

export function isInstrumentId(value: unknown): value is InstrumentId {
  return value === "guitar" || value === "keys";
}
