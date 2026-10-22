import { resolveProgression, type ChordSpec, type InstrumentId, type ModeId, type Quality, type ResolvedChord } from "@/lib/music/theory";

export type SectionRole = "intro" | "verse" | "pre" | "chorus" | "bridge" | "outro";

export type PlayScope = "section" | "song";

export type SongSection = {
  id: string;
  role: SectionRole;
  name: string;
  chords: ChordSpec[];
  selectedId: string;
  lyrics: string;
};

export type PlayChord = ResolvedChord & {
  sectionId: string;
  localIndex: number;
  arrangementIndex: number;
};

export const SECTION_ROLES: { id: SectionRole; label: string }[] = [
  { id: "intro", label: "Intro" },
  { id: "verse", label: "Verse" },
  { id: "pre", label: "Pre-chorus" },
  { id: "chorus", label: "Chorus" },
  { id: "bridge", label: "Bridge" },
  { id: "outro", label: "Outro" },
];

const ROLE_SET = new Set<SectionRole>(SECTION_ROLES.map((role) => role.id));

export function isSectionRole(value: unknown): value is SectionRole {
  return typeof value === "string" && ROLE_SET.has(value as SectionRole);
}

export function isPlayScope(value: unknown): value is PlayScope {
  return value === "section" || value === "song";
}

export function roleLabel(role: SectionRole): string {
  return SECTION_ROLES.find((item) => item.id === role)?.label ?? "Verse";
}

export function nextSectionName(sections: { role: SectionRole }[], role: SectionRole): string {
  const label = roleLabel(role);
  const count = sections.filter((section) => section.role === role).length;
  return count === 0 ? label : `${label} ${count + 1}`;
}

const SHAPE: Record<SectionRole, { semitones: number; quality: Quality; beats: number }[]> = {
  intro: [
    { semitones: 0, quality: "maj", beats: 4 },
    { semitones: 5, quality: "maj", beats: 4 },
  ],
  verse: [
    { semitones: 0, quality: "maj", beats: 4 },
    { semitones: 7, quality: "maj", beats: 4 },
    { semitones: 9, quality: "min", beats: 4 },
    { semitones: 5, quality: "maj", beats: 4 },
  ],
  pre: [
    { semitones: 9, quality: "min", beats: 4 },
    { semitones: 5, quality: "maj", beats: 4 },
    { semitones: 0, quality: "maj", beats: 4 },
    { semitones: 7, quality: "maj", beats: 4 },
  ],
  chorus: [
    { semitones: 9, quality: "min", beats: 4 },
    { semitones: 5, quality: "maj", beats: 4 },
    { semitones: 0, quality: "maj", beats: 4 },
    { semitones: 7, quality: "maj", beats: 4 },
  ],
  bridge: [
    { semitones: 2, quality: "min", beats: 4 },
    { semitones: 7, quality: "maj", beats: 4 },
    { semitones: 0, quality: "maj", beats: 4 },
  ],
  outro: [
    { semitones: 0, quality: "maj", beats: 4 },
    { semitones: 5, quality: "maj", beats: 4 },
    { semitones: 0, quality: "maj", beats: 8 },
  ],
};

export function shapeFor(role: SectionRole): { semitones: number; quality: Quality; beats: number }[] {
  return SHAPE[role].map((chord) => ({ ...chord }));
}

export function lyricCue(
  lyrics: string,
  chordIndex: number,
  chordCount: number,
): { index: number; text: string } | null {
  if (!lyrics.trim()) return null;
  const lines = lyrics.replace(/\r\n/g, "\n").split("\n");
  const safeCount = Math.max(chordCount, 1);
  const index =
    lines.length === 1
      ? 0
      : lines.length === safeCount
        ? Math.min(Math.max(chordIndex, 0), lines.length - 1)
        : Math.min(lines.length - 1, Math.floor((Math.max(chordIndex, 0) / safeCount) * lines.length));
  return { index, text: lines[index] ?? "" };
}

export function flattenSong(
  sections: SongSection[],
  arrangement: string[],
  activeId: string,
  scope: PlayScope,
  keyRoot: number,
  mode: ModeId,
  instrument: InstrumentId,
): PlayChord[] {
  const order = scope === "song" ? arrangement : [activeId];
  const flat: PlayChord[] = [];
  order.forEach((sectionId, arrangementIndex) => {
    const section = sections.find((item) => item.id === sectionId);
    if (!section) return;
    const resolved = resolveProgression(section.chords, keyRoot, mode, instrument);
    resolved.forEach((chord, localIndex) => {
      flat.push({
        ...chord,
        id: `${arrangementIndex}:${section.id}:${chord.id}`,
        sectionId: section.id,
        localIndex,
        arrangementIndex,
      });
    });
  });
  if (flat.length) return flat;
  const fallback = resolveProgression([], keyRoot, mode, instrument)[0];
  if (!fallback) return [];
  return [{ ...fallback, id: "fallback", sectionId: activeId, localIndex: 0, arrangementIndex: 0 }];
}
