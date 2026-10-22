import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  isPlayScope,
  isSectionRole,
  nextSectionName,
  shapeFor,
  type PlayScope,
  type SectionRole,
  type SongSection,
} from "@/lib/music/song";
import {
  clampBpm,
  isInstrumentId,
  isModeId,
  isPatternId,
  PRESETS,
  sanitizeChord,
  type ChordSpec,
  type InstrumentId,
  type ModeId,
  type PatternId,
  type Quality,
} from "@/lib/music/theory";

export type SavedLoop = {
  id: string;
  name: string;
  keyRoot: number;
  mode: ModeId;
  chords: ChordSpec[];
  sections?: SongSection[];
  arrangement?: string[];
  scope?: PlayScope;
};

type VampState = {
  keyRoot: number;
  mode: ModeId;
  sections: SongSection[];
  activeSectionId: string;
  arrangement: string[];
  arrangementIndex: number;
  scope: PlayScope;
  bpm: number;
  pattern: PatternId;
  instrument: InstrumentId;
  loop: boolean;
  metronome: boolean;
  countIn: boolean;
  saved: SavedLoop[];
  setKey: (root: number) => void;
  setMode: (mode: ModeId) => void;
  setBpm: (bpm: number) => void;
  setPattern: (pattern: PatternId) => void;
  setInstrument: (instrument: InstrumentId) => void;
  setLoop: (loop: boolean) => void;
  setMetronome: (on: boolean) => void;
  setCountIn: (on: boolean) => void;
  setScope: (scope: PlayScope) => void;
  setLyrics: (lyrics: string) => void;
  selectSection: (id: string) => void;
  selectArrangement: (index: number) => void;
  addSection: (role: SectionRole) => void;
  deleteSection: (id: string) => void;
  repeatArrangement: () => void;
  moveArrangement: (direction: -1 | 1) => void;
  dropArrangement: () => void;
  select: (id: string) => void;
  patchSelected: (partial: Partial<Pick<ChordSpec, "semitones" | "quality" | "beats">>) => void;
  moveSelected: (direction: -1 | 1) => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  addAfterSelected: () => void;
  applyPreset: (id: string) => void;
  saveLoop: (name: string) => void;
  loadLoop: (id: string) => void;
  deleteLoop: (id: string) => void;
};

const VERSE_CHORDS: ChordSpec[] = [
  { id: "axis-1", semitones: 0, quality: "maj", beats: 4 },
  { id: "axis-2", semitones: 7, quality: "maj", beats: 4 },
  { id: "axis-3", semitones: 9, quality: "min", beats: 4 },
  { id: "axis-4", semitones: 5, quality: "maj", beats: 4 },
];

const CHORUS_CHORDS: ChordSpec[] = [
  { id: "ch-1", semitones: 9, quality: "min", beats: 4 },
  { id: "ch-2", semitones: 5, quality: "maj", beats: 4 },
  { id: "ch-3", semitones: 0, quality: "maj", beats: 4 },
  { id: "ch-4", semitones: 7, quality: "maj", beats: 4 },
];

const VERSE_ID = "sec-verse";
const CHORUS_ID = "sec-chorus";

function defaultSections(): SongSection[] {
  return [
    { id: VERSE_ID, role: "verse", name: "Verse", chords: VERSE_CHORDS, selectedId: VERSE_CHORDS[0].id, lyrics: "" },
    {
      id: CHORUS_ID,
      role: "chorus",
      name: "Chorus",
      chords: CHORUS_CHORDS,
      selectedId: CHORUS_CHORDS[0].id,
      lyrics: "",
    },
  ];
}

function uid() {
  return crypto.randomUUID();
}

function copyChords(chords: ChordSpec[]): ChordSpec[] {
  return chords.map((chord, index) => sanitizeChord({ ...chord }, index));
}

function activeOf(state: { sections: SongSection[]; activeSectionId: string }): SongSection {
  return state.sections.find((section) => section.id === state.activeSectionId) ?? state.sections[0];
}

function mapActive(state: { sections: SongSection[]; activeSectionId: string }, mapper: (section: SongSection) => SongSection) {
  const current = activeOf(state);
  return state.sections.map((section) => (section.id === current.id ? mapper(section) : section));
}

function withChords(section: SongSection, chords: ChordSpec[], selectedId = section.selectedId): SongSection {
  const safe = chords.length ? chords : section.chords;
  const nextSelected = safe.some((chord) => chord.id === selectedId) ? selectedId : safe[0].id;
  return { ...section, chords: safe, selectedId: nextSelected };
}

function cloneSong(sections: SongSection[], arrangement: string[]) {
  const map = new Map<string, string>();
  const nextSections = sections.map((section) => {
    const id = uid();
    map.set(section.id, id);
    const chords = section.chords.map((chord) => sanitizeChord({ ...chord, id: uid() }, 0));
    return {
      ...section,
      id,
      name: section.name.slice(0, 32),
      lyrics: section.lyrics.slice(0, 4000),
      chords,
      selectedId: chords[0]?.id ?? "",
    };
  });
  const nextArrangement = arrangement.map((id) => map.get(id)).filter((id): id is string => !!id);
  return {
    sections: nextSections,
    arrangement: nextArrangement.length ? nextArrangement : [nextSections[0]?.id ?? ""],
  };
}

function sanitizeSections(value: unknown): SongSection[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const sections = value.slice(0, 8).flatMap((item, index): SongSection[] => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Partial<SongSection>;
    const chords = Array.isArray(raw.chords) ? copyChords(raw.chords).slice(0, 32) : [];
    if (!chords.length) return [];
    const id = typeof raw.id === "string" && raw.id ? raw.id : `sec-${index}`;
    return [
      {
        id,
        role: isSectionRole(raw.role) ? raw.role : "verse",
        name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 32) : "Verse",
        chords,
        selectedId: chords.some((chord) => chord.id === raw.selectedId) ? String(raw.selectedId) : chords[0].id,
        lyrics: typeof raw.lyrics === "string" ? raw.lyrics.slice(0, 4000) : "",
      },
    ];
  });
  return sections.length ? sections : null;
}

export const useVamp = create<VampState>()(
  persist(
    (set, get) => ({
      keyRoot: 0,
      mode: "major",
      sections: defaultSections(),
      activeSectionId: VERSE_ID,
      arrangement: [VERSE_ID, CHORUS_ID, VERSE_ID, CHORUS_ID],
      arrangementIndex: 0,
      scope: "song",
      bpm: 96,
      pattern: "folk",
      instrument: "guitar",
      loop: true,
      metronome: false,
      countIn: false,
      saved: [],
      setKey: (root) => set({ keyRoot: ((root % 12) + 12) % 12 }),
      setMode: (mode) => set({ mode }),
      setBpm: (bpm) => set({ bpm: clampBpm(bpm) }),
      setPattern: (pattern) => set({ pattern }),
      setInstrument: (instrument) => set({ instrument }),
      setLoop: (loop) => set({ loop }),
      setMetronome: (metronome) => set({ metronome }),
      setCountIn: (countIn) => set({ countIn }),
      setScope: (scope) => set({ scope }),
      setLyrics: (lyrics) => {
        const state = get();
        set({
          sections: mapActive(state, (section) => ({ ...section, lyrics: lyrics.slice(0, 4000) })),
        });
      },
      selectSection: (id) => {
        const { sections, arrangement, arrangementIndex } = get();
        if (!sections.some((section) => section.id === id)) return;
        const index = arrangement.findIndex((item) => item === id);
        set({ activeSectionId: id, arrangementIndex: index >= 0 ? index : arrangementIndex });
      },
      selectArrangement: (index) => {
        const { arrangement, sections } = get();
        const id = arrangement[index];
        if (!id || !sections.some((section) => section.id === id)) return;
        set({ arrangementIndex: index, activeSectionId: id });
      },
      addSection: (role) => {
        const state = get();
        if (state.sections.length >= 8) return;
        const chords = shapeFor(role).map((chord) => sanitizeChord({ ...chord, id: uid() }, 0));
        const section: SongSection = {
          id: uid(),
          role,
          name: nextSectionName(state.sections, role),
          chords,
          selectedId: chords[0]?.id ?? "",
          lyrics: "",
        };
        const arrangement = [...state.arrangement, section.id].slice(0, 16);
        set({
          sections: [...state.sections, section],
          arrangement,
          activeSectionId: section.id,
          arrangementIndex: arrangement.length - 1,
        });
      },
      deleteSection: (id) => {
        const { sections, arrangement, activeSectionId } = get();
        if (sections.length <= 1) return;
        const nextSections = sections.filter((section) => section.id !== id);
        let nextArrangement = arrangement.filter((item) => item !== id);
        if (!nextArrangement.length) nextArrangement = [nextSections[0].id];
        const nextActive = activeSectionId === id ? nextSections[0].id : activeSectionId;
        const index = Math.max(0, nextArrangement.findIndex((item) => item === nextActive));
        set({
          sections: nextSections,
          arrangement: nextArrangement,
          activeSectionId: nextActive,
          arrangementIndex: index,
        });
      },
      repeatArrangement: () => {
        const { arrangement, arrangementIndex, activeSectionId } = get();
        if (arrangement.length >= 16) return;
        const id = arrangement[arrangementIndex] ?? activeSectionId;
        const next = [...arrangement];
        next.splice(Math.max(0, arrangementIndex) + 1, 0, id);
        set({ arrangement: next, arrangementIndex: Math.max(0, arrangementIndex) + 1 });
      },
      moveArrangement: (direction) => {
        const { arrangement, arrangementIndex } = get();
        const nextIndex = arrangementIndex + direction;
        if (arrangementIndex < 0 || nextIndex < 0 || nextIndex >= arrangement.length) return;
        const copy = [...arrangement];
        const [item] = copy.splice(arrangementIndex, 1);
        if (!item) return;
        copy.splice(nextIndex, 0, item);
        set({ arrangement: copy, arrangementIndex: nextIndex });
      },
      dropArrangement: () => {
        const { arrangement, arrangementIndex, sections } = get();
        if (arrangement.length <= 1) return;
        const next = arrangement.filter((_, index) => index !== arrangementIndex);
        const index = Math.min(arrangementIndex, next.length - 1);
        const id = next[index];
        set({
          arrangement: next,
          arrangementIndex: index,
          activeSectionId: sections.some((section) => section.id === id) ? id : sections[0].id,
        });
      },
      select: (id) => {
        const state = get();
        const section = activeOf(state);
        if (!section.chords.some((chord) => chord.id === id)) return;
        set({ sections: mapActive(state, (current) => ({ ...current, selectedId: id })) });
      },
      patchSelected: (partial) => {
        const state = get();
        set({
          sections: mapActive(state, (section) =>
            withChords(
              section,
              section.chords.map((chord) =>
                chord.id === section.selectedId ? sanitizeChord({ ...chord, ...partial }, 0) : chord,
              ),
            ),
          ),
        });
      },
      moveSelected: (direction) => {
        const state = get();
        const section = activeOf(state);
        const index = section.chords.findIndex((chord) => chord.id === section.selectedId);
        const next = index + direction;
        if (index < 0 || next < 0 || next >= section.chords.length) return;
        const copy = [...section.chords];
        const [item] = copy.splice(index, 1);
        if (!item) return;
        copy.splice(next, 0, item);
        set({ sections: mapActive(state, (current) => withChords(current, copy)) });
      },
      duplicateSelected: () => {
        const state = get();
        const section = activeOf(state);
        if (section.chords.length >= 32) return;
        const index = section.chords.findIndex((chord) => chord.id === section.selectedId);
        const source = section.chords[index];
        if (!source) return;
        const copy = [...section.chords];
        const duplicate = { ...source, id: uid() };
        copy.splice(index + 1, 0, duplicate);
        set({ sections: mapActive(state, (current) => withChords(current, copy, duplicate.id)) });
      },
      deleteSelected: () => {
        const state = get();
        const section = activeOf(state);
        if (section.chords.length <= 1) return;
        const index = section.chords.findIndex((chord) => chord.id === section.selectedId);
        const next = section.chords.filter((chord) => chord.id !== section.selectedId);
        const selected = (next[Math.max(0, index - 1)] ?? next[0]).id;
        set({ sections: mapActive(state, (current) => withChords(current, next, selected)) });
      },
      addAfterSelected: () => {
        const state = get();
        const section = activeOf(state);
        if (section.chords.length >= 32) return;
        const index = Math.max(0, section.chords.findIndex((chord) => chord.id === section.selectedId));
        const source = section.chords[index];
        const added: ChordSpec = source
          ? { ...source, id: uid() }
          : { id: uid(), semitones: 0, quality: "maj", beats: 4 };
        const copy = [...section.chords];
        copy.splice(index + 1, 0, added);
        set({ sections: mapActive(state, (current) => withChords(current, copy, added.id)) });
      },
      applyPreset: (id) => {
        const preset = PRESETS.find((item) => item.id === id);
        if (!preset) return;
        const state = get();
        const chords = preset.chords.map((chord) => ({ ...chord, id: uid() }));
        set({ sections: mapActive(state, (section) => withChords(section, chords, chords[0]?.id ?? "")) });
      },
      saveLoop: (name) => {
        const trimmed = name.trim().slice(0, 40);
        if (!trimmed) return;
        const { keyRoot, mode, sections, arrangement, scope, saved } = get();
        const current = activeOf(get());
        const snapshot = sections.map((section) => ({
          ...section,
          chords: copyChords(section.chords),
          lyrics: section.lyrics,
        }));
        const entry: SavedLoop = {
          id: uid(),
          name: trimmed,
          keyRoot,
          mode,
          chords: copyChords(current.chords),
          sections: snapshot,
          arrangement: [...arrangement],
          scope,
        };
        set({ saved: [entry, ...saved].slice(0, 24) });
      },
      loadLoop: (id) => {
        const entry = get().saved.find((item) => item.id === id);
        if (!entry) return;
        const keyRoot = ((entry.keyRoot % 12) + 12) % 12;
        const mode = entry.mode;
        if (entry.sections?.length && entry.arrangement?.length) {
          const song = cloneSong(entry.sections, entry.arrangement);
          set({
            keyRoot,
            mode,
            sections: song.sections,
            arrangement: song.arrangement,
            activeSectionId: song.sections[0]?.id ?? "",
            arrangementIndex: 0,
            scope: entry.scope ?? "song",
          });
          return;
        }
        const state = get();
        const chords = entry.chords.map((chord) => sanitizeChord({ ...chord, id: uid() }, 0));
        set({
          keyRoot,
          mode,
          sections: mapActive(state, (section) => withChords(section, chords, chords[0]?.id ?? "")),
        });
      },
      deleteLoop: (id) => set({ saved: get().saved.filter((item) => item.id !== id) }),
    }),
    {
      name: "vamp-loops",
      skipHydration: true,
      version: 2,
      migrate: (persisted, version) => {
        const data = (persisted ?? {}) as Partial<VampState> & { chords?: ChordSpec[]; selectedId?: string };
        if (version < 2 && !Array.isArray(data.sections)) {
          const chords = Array.isArray(data.chords) && data.chords.length ? data.chords : VERSE_CHORDS;
          const section: SongSection = {
            id: VERSE_ID,
            role: "verse",
            name: "Verse",
            chords,
            selectedId: chords.some((chord) => chord.id === data.selectedId) ? String(data.selectedId) : chords[0].id,
            lyrics: "",
          };
          return {
            ...data,
            sections: [section],
            arrangement: [section.id],
            activeSectionId: section.id,
            arrangementIndex: 0,
            scope: "section" as const,
          };
        }
        return data;
      },
      partialize: (state) => ({
        keyRoot: state.keyRoot,
        mode: state.mode,
        sections: state.sections,
        activeSectionId: state.activeSectionId,
        arrangement: state.arrangement,
        arrangementIndex: state.arrangementIndex,
        scope: state.scope,
        bpm: state.bpm,
        pattern: state.pattern,
        instrument: state.instrument,
        loop: state.loop,
        metronome: state.metronome,
        countIn: state.countIn,
        saved: state.saved,
      }),
      merge: (persisted, current) => {
        const data = (persisted ?? {}) as Partial<VampState>;
        const sections = sanitizeSections(data.sections) ?? current.sections;
        const known = new Set(sections.map((section) => section.id));
        const arrangement = Array.isArray(data.arrangement)
          ? data.arrangement.filter((id): id is string => typeof id === "string" && known.has(id)).slice(0, 16)
          : [];
        const safeArrangement = arrangement.length ? arrangement : [sections[0].id];
        const activeSectionId = known.has(String(data.activeSectionId)) ? String(data.activeSectionId) : sections[0].id;
        const arrangementIndex = Math.min(
          safeArrangement.length - 1,
          Math.max(0, typeof data.arrangementIndex === "number" ? data.arrangementIndex : 0),
        );
        const saved = Array.isArray(data.saved)
          ? data.saved
              .filter((item): item is SavedLoop => !!item && typeof item === "object" && typeof item.name === "string")
              .slice(0, 24)
              .map((item) => ({
                id: item.id || uid(),
                name: item.name.slice(0, 40),
                keyRoot: Number.isFinite(item.keyRoot) ? ((item.keyRoot % 12) + 12) % 12 : 0,
                mode: isModeId(item.mode) ? item.mode : "major",
                chords: Array.isArray(item.chords) ? copyChords(item.chords).slice(0, 32) : copyChords(VERSE_CHORDS),
                sections: sanitizeSections(item.sections) ?? undefined,
                arrangement: Array.isArray(item.arrangement)
                  ? item.arrangement.filter((id): id is string => typeof id === "string").slice(0, 16)
                  : undefined,
                scope: isPlayScope(item.scope) ? item.scope : undefined,
              }))
          : [];
        return {
          ...current,
          keyRoot: Number.isFinite(data.keyRoot) ? ((((data.keyRoot as number) % 12) + 12) % 12) : current.keyRoot,
          mode: isModeId(data.mode) ? data.mode : current.mode,
          sections,
          activeSectionId,
          arrangement: safeArrangement,
          arrangementIndex,
          scope: isPlayScope(data.scope) ? data.scope : current.scope,
          bpm: clampBpm(typeof data.bpm === "number" ? data.bpm : current.bpm),
          pattern: isPatternId(data.pattern) ? data.pattern : current.pattern,
          instrument: isInstrumentId(data.instrument) ? data.instrument : current.instrument,
          loop: typeof data.loop === "boolean" ? data.loop : current.loop,
          metronome: typeof data.metronome === "boolean" ? data.metronome : current.metronome,
          countIn: typeof data.countIn === "boolean" ? data.countIn : current.countIn,
          saved,
        };
      },
    },
  ),
);

export type { Quality };
