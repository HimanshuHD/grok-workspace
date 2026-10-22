import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as Slider from "@radix-ui/react-slider";
import { Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { engine, type TransportSnap } from "@/lib/music/engine";
import { flattenSong, lyricCue, SECTION_ROLES } from "@/lib/music/song";
import { useVamp } from "@/lib/music/store";
import {
  BEAT_OPTIONS,
  borrowedChoices,
  diatonicChoices,
  keyLabel,
  lengthLabel,
  MODES,
  PATTERNS,
  PRESETS,
  QUALITY_OPTIONS,
  resolveProgression,
  sameChords,
  scaleNotes,
  tonicName,
  type PatternId,
  type Quality,
} from "@/lib/music/theory";

const IDLE_SNAP: TransportSnap = {
  playing: false,
  engaged: false,
  counting: false,
  countBeat: 0,
  slot: 0,
  beat: 0,
  progress: 0,
  beats: 4,
};

function useTransport() {
  const [snap, setSnap] = useState<TransportSnap>(IDLE_SNAP);
  useEffect(() => {
    let frame = 0;
    let previous = "";
    const tick = () => {
      const next = engine.visual();
      const key = `${next.playing}|${next.engaged}|${next.counting}|${next.countBeat}|${next.slot}|${next.beat}`;
      if (key !== previous) {
        previous = key;
        setSnap(next);
      }
      const bar = document.getElementById("playhead");
      if (bar) {
        const scale = next.playing && !next.counting ? next.progress : 0;
        bar.style.transform = `scaleX(${scale})`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return snap;
}

export function VampApp() {
  const keyRoot = useVamp((state) => state.keyRoot);
  const mode = useVamp((state) => state.mode);
  const sections = useVamp((state) => state.sections);
  const activeSectionId = useVamp((state) => state.activeSectionId);
  const arrangement = useVamp((state) => state.arrangement);
  const arrangementIndex = useVamp((state) => state.arrangementIndex);
  const scope = useVamp((state) => state.scope);
  const bpm = useVamp((state) => state.bpm);
  const pattern = useVamp((state) => state.pattern);
  const instrument = useVamp((state) => state.instrument);
  const loop = useVamp((state) => state.loop);
  const metronome = useVamp((state) => state.metronome);
  const countIn = useVamp((state) => state.countIn);
  const saved = useVamp((state) => state.saved);
  const setKey = useVamp((state) => state.setKey);
  const setMode = useVamp((state) => state.setMode);
  const setBpm = useVamp((state) => state.setBpm);
  const setPattern = useVamp((state) => state.setPattern);
  const setInstrument = useVamp((state) => state.setInstrument);
  const setLoop = useVamp((state) => state.setLoop);
  const setMetronome = useVamp((state) => state.setMetronome);
  const setCountIn = useVamp((state) => state.setCountIn);
  const setScope = useVamp((state) => state.setScope);
  const setLyrics = useVamp((state) => state.setLyrics);
  const selectSection = useVamp((state) => state.selectSection);
  const selectArrangement = useVamp((state) => state.selectArrangement);
  const addSection = useVamp((state) => state.addSection);
  const deleteSection = useVamp((state) => state.deleteSection);
  const repeatArrangement = useVamp((state) => state.repeatArrangement);
  const moveArrangement = useVamp((state) => state.moveArrangement);
  const dropArrangement = useVamp((state) => state.dropArrangement);
  const select = useVamp((state) => state.select);
  const patchSelected = useVamp((state) => state.patchSelected);
  const moveSelected = useVamp((state) => state.moveSelected);
  const duplicateSelected = useVamp((state) => state.duplicateSelected);
  const deleteSelected = useVamp((state) => state.deleteSelected);
  const addAfterSelected = useVamp((state) => state.addAfterSelected);
  const applyPreset = useVamp((state) => state.applyPreset);
  const saveLoop = useVamp((state) => state.saveLoop);
  const loadLoop = useVamp((state) => state.loadLoop);
  const deleteLoop = useVamp((state) => state.deleteLoop);

  const snap = useTransport();
  const arm = useRef(false);
  const lyricList = useRef<HTMLUListElement>(null);
  const [loopName, setLoopName] = useState("");
  const [adding, setAdding] = useState(false);

  const section = sections.find((item) => item.id === activeSectionId) ?? sections[0];
  const chords = section?.chords ?? [];
  const selectedId = section?.selectedId ?? "";

  const resolved = useMemo(
    () => resolveProgression(chords, keyRoot, mode, instrument),
    [chords, keyRoot, mode, instrument],
  );
  const playback = useMemo(
    () => flattenSong(sections, arrangement, section?.id ?? "", scope, keyRoot, mode, instrument),
    [sections, arrangement, section?.id, scope, keyRoot, mode, instrument],
  );

  useEffect(() => {
    void useVamp.persist.rehydrate();
  }, []);

  useEffect(() => {
    engine.setSession({ bpm, pattern, instrument, loop, metronome, countIn, chords: playback });
  }, [bpm, pattern, instrument, loop, metronome, countIn, playback]);

  useEffect(() => {
    if (!arm.current) return;
    arm.current = false;
    if (engine.isPlaying()) return;
    const chord = resolved.find((item) => item.id === selectedId) ?? resolved[0];
    if (chord) void engine.preview(chord);
  }, [resolved, selectedId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [role='slider']")) return;
      if (event.code === "Space") {
        event.preventDefault();
        void engine.toggle();
        return;
      }
      if (event.code === "ArrowRight" || event.code === "ArrowLeft") {
        event.preventDefault();
        const state = useVamp.getState();
        const open = state.sections.find((item) => item.id === state.activeSectionId) ?? state.sections[0];
        const index = open?.chords.findIndex((chord) => chord.id === open.selectedId) ?? -1;
        const next = open?.chords[index + (event.code === "ArrowRight" ? 1 : -1)];
        if (!next) return;
        arm.current = true;
        state.select(next.id);
        return;
      }
      if (event.code === "ArrowUp" || event.code === "ArrowDown") {
        event.preventDefault();
        const state = useVamp.getState();
        state.setBpm(state.bpm + (event.code === "ArrowUp" ? 1 : -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const playing = snap.playing || snap.engaged ? playback[Math.min(snap.slot, Math.max(0, playback.length - 1))] : undefined;
  const playingSection = sections.find((item) => item.id === playing?.sectionId);
  const soundingHere = playing && playing.sectionId === section?.id ? chords[playing.localIndex] : undefined;
  const selected = resolved.find((chord) => chord.id === selectedId) ?? resolved[0];
  const shown = snap.playing && playing ? playing : selected;
  const activeCardId = snap.playing ? soundingHere?.id : selectedId;
  const resumeId = snap.engaged && !snap.playing ? soundingHere?.id : undefined;
  const scale = scaleNotes(keyRoot, mode);
  const totalBeats = (scope === "song" ? playback : resolved).reduce((sum, chord) => sum + chord.beats, 0);
  const diatonic = diatonicChoices(keyRoot, mode);
  const borrowed = borrowedChoices(keyRoot, mode);
  const patternMeta = PATTERNS.find((item) => item.id === pattern) ?? PATTERNS[0];
  const localIndex = snap.playing && playing ? playing.localIndex : Math.max(0, chords.findIndex((chord) => chord.id === selectedId));
  const localCount = snap.playing && playingSection ? (sections.find((item) => item.id === playing.sectionId)?.chords.length ?? resolved.length) : resolved.length;
  const place = localIndex + 1;
  const placeName = (snap.playing ? playingSection?.name : section?.name) ?? "Verse";
  const cueSource = (snap.playing ? playingSection : section)?.lyrics ?? "";
  const cueCount = snap.playing && playingSection ? playingSection.chords.length : chords.length;
  const cue = lyricCue(cueSource, localIndex, cueCount);
  const lyricLines = (section?.lyrics ?? "").replace(/\r\n/g, "\n").split("\n");
  const songBeats = playback.reduce((sum, chord) => sum + chord.beats, 0);
  const visibleSlot = snap.playing && playing?.sectionId === section?.id ? playing.localIndex : -1;
  const padLine = !snap.playing || playingSection?.id === section?.id ? (cue?.index ?? -1) : -1;

  useEffect(() => {
    if (!snap.playing || visibleSlot < 0) return;
    const rail = document.getElementById("chord-rail");
    const card = rail?.querySelector<HTMLElement>(`[data-slot="${visibleSlot}"]`);
    if (!rail || !card || rail.scrollWidth <= rail.clientWidth + 8) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cardBox = card.getBoundingClientRect();
    const railBox = rail.getBoundingClientRect();
    const left = cardBox.left - railBox.left + rail.scrollLeft - rail.clientWidth / 2 + cardBox.width / 2;
    rail.scrollTo({ left, behavior: reduce ? "auto" : "smooth" });
  }, [snap.playing, visibleSlot]);

  useEffect(() => {
    const root = lyricList.current;
    if (!root || padLine < 0) return;
    const line = root.querySelector<HTMLElement>(`[data-lyric-line="${padLine}"]`);
    if (!line) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.scrollTo({
      top: line.offsetTop - root.clientHeight / 2 + line.clientHeight / 2,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [padLine, snap.slot, snap.playing]);

  function previewAfter(action: () => void) {
    arm.current = true;
    action();
  }

  return (
    <div className="deck-offset min-h-dvh bg-canvas text-ink" data-playing={snap.playing} data-chord={shown?.symbol ?? ""} data-section={section?.name ?? ""} data-scope={scope}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pt-5 md:px-6 md:pt-7">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-4xl leading-none tracking-tight italic">Vamp</h1>
            <p className="mt-1 text-sm text-muted">Chord loops for songwriting</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="font-display text-2xl leading-none tracking-tight">{keyLabel(keyRoot, mode)}</p>
            <p className="mt-1 text-sm text-muted">{scale.join(" ")}</p>
          </div>
        </header>

        <section className="min-w-0">
          <div className="rounded-3xl bg-panel p-4">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-medium text-ink">Song</h2>
              <p className="text-xs text-faint">{lengthLabel(songBeats)}</p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sections.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={item.id === section?.id}
                  onClick={() => selectSection(item.id)}
                  className={chip(item.id === section?.id, "h-11 shrink-0 px-3 text-sm")}
                >
                  {item.name}
                </button>
              ))}
              <button
                type="button"
                aria-expanded={adding}
                onClick={() => setAdding((open) => !open)}
                disabled={sections.length >= 8}
                className="h-11 shrink-0 rounded-lg border border-dashed border-line px-3 text-sm text-muted"
              >
                Add section
              </button>
            </div>
            {adding ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {SECTION_ROLES.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      addSection(role.id);
                      setAdding(false);
                    }}
                    className="h-11 rounded-lg bg-raised px-3 text-sm text-ink"
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            ) : null}
            <p className="mt-4 mb-2 text-xs text-faint">Order</p>
            <ol className="flex gap-2 overflow-x-auto pb-1">
              {arrangement.map((id, index) => {
                const name = sections.find((item) => item.id === id)?.name ?? "Section";
                const on = index === arrangementIndex;
                const sounding = scope === "song" && snap.playing && playing?.arrangementIndex === index;
                return (
                  <li key={`${id}-${index}`} className="shrink-0">
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-current={sounding ? "true" : undefined}
                      onClick={() => selectArrangement(index)}
                      className={cn(
                        "h-11 rounded-lg px-3 text-sm font-medium tabular-nums",
                        sounding ? "bg-bone text-bone-ink" : on ? "bg-raised text-ink ring-2 ring-accent ring-inset" : "bg-raised text-ink",
                      )}
                    >
                      {index + 1} {name}
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={scope === "section"}
                onClick={() => setScope("section")}
                className={chip(scope === "section", "h-11 px-3 text-sm")}
              >
                This section
              </button>
              <button
                type="button"
                aria-pressed={scope === "song"}
                onClick={() => setScope("song")}
                className={chip(scope === "song", "h-11 px-3 text-sm")}
              >
                Whole song
              </button>
              <TextButton label="Earlier" onClick={() => moveArrangement(-1)} disabled={arrangementIndex <= 0} />
              <TextButton
                label="Later"
                onClick={() => moveArrangement(1)}
                disabled={arrangementIndex >= arrangement.length - 1}
              />
              <TextButton label="Repeat" onClick={repeatArrangement} disabled={arrangement.length >= 16} />
              <TextButton label="Drop" onClick={dropArrangement} disabled={arrangement.length <= 1} />
              <TextButton
                label="Delete section"
                onClick={() => section && deleteSection(section.id)}
                disabled={sections.length <= 1}
              />
            </div>
          </div>

          <div className="relative mt-4 overflow-hidden rounded-3xl bg-panel px-5 pt-6 pb-7 md:px-8 md:pt-8">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-muted">
                {snap.counting ? `Count-in ${snap.countBeat || ""}`.trim() : shown?.roman}
              </p>
              <p className="text-sm text-faint tabular-nums">
                {placeName} · {place} / {localCount}
              </p>
            </div>
            <p
              className={cn(
                "mt-2 font-display leading-none tracking-tight italic",
                (shown?.symbol.length ?? 0) >= 6 ? "text-5xl md:text-7xl" : "text-6xl md:text-8xl",
              )}
            >
              {shown?.symbol}
            </p>
            {cue?.text.trim() ? (
              <p className="mt-4 line-clamp-2 font-display text-xl leading-snug tracking-tight text-balance italic md:text-2xl">
                {cue.text}
              </p>
            ) : null}
            <p className={cn("text-base text-muted", cue?.text.trim() ? "mt-3" : "mt-4")}>{shown?.notes.join("  ·  ")}</p>
            <div className="mt-5 flex flex-wrap gap-1.5" aria-hidden="true">
              {Array.from({ length: shown?.beats ?? 0 }, (_, index) => {
                const lit = snap.playing && !snap.counting && !!soundingHere && shown?.id === playing?.id;
                return (
                  <span
                    key={index}
                    className={cn(
                      "h-1.5 w-6 rounded-full",
                      lit && index === snap.beat ? "bg-bone" : lit && index < snap.beat ? "bg-accent" : "bg-raised",
                    )}
                  />
                );
              })}
            </div>
            <p className="mt-4 text-sm text-faint">
              {snap.engaged && !snap.playing && playing
                ? `Paused · resumes on ${playing.symbol}`
                : lengthLabel(totalBeats)}
            </p>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-raised">
              <div id="playhead" className="h-full origin-left bg-bone" style={{ transform: "scaleX(0)" }} />
            </div>
          </div>

          <ol id="chord-rail" className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-4">
            {resolved.map((chord, index) => {
              const active = chord.id === activeCardId;
              const marked = chord.id === resumeId || (chord.id === selectedId && !active);
              return (
                <li key={chord.id} className="contents lg:block">
                  <button
                    type="button"
                    data-slot={index}
                    aria-pressed={chord.id === selectedId}
                    aria-current={active && snap.playing ? "true" : undefined}
                    onClick={() => {
                      if (chord.id === selectedId) {
                        if (!engine.isPlaying()) void engine.preview(chord);
                        return;
                      }
                      previewAfter(() => select(chord.id));
                    }}
                    className={cn(
                      "flex h-full w-36 shrink-0 flex-col rounded-2xl px-3 py-3 text-left transition-colors duration-150 lg:w-auto",
                      active ? "bg-bone text-bone-ink" : "bg-panel text-ink hover:bg-raised",
                      marked && "ring-2 ring-accent ring-inset",
                    )}
                  >
                    <span className={cn("text-xs", active ? "text-bone-muted" : "text-muted")}>{chord.roman}</span>
                    <span className="mt-1 font-display text-3xl leading-none tracking-tight">{chord.symbol}</span>
                    <span className={cn("mt-3 text-xs tabular-nums", active ? "text-bone-muted" : "text-faint")}>
                      {chord.beats} {chord.beats === 1 ? "beat" : "beats"}
                    </span>
                  </button>
                </li>
              );
            })}
            <li className="contents lg:block">
              <button
                type="button"
                onClick={() => previewAfter(addAfterSelected)}
                disabled={chords.length >= 32}
                className="flex min-h-28 w-36 shrink-0 items-center justify-center gap-1 rounded-2xl border border-dashed border-line text-sm text-muted lg:h-full lg:w-auto"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add
              </button>
            </li>
          </ol>

          <div className="mt-4 rounded-3xl bg-panel p-4">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-medium text-ink">Lyrics · {section?.name}</h2>
              <p className="text-xs text-faint">One line per chord follows the loop</p>
            </div>
            {section?.lyrics.trim() ? (
              <ul ref={lyricList} className="relative mb-3 max-h-36 overflow-y-auto rounded-lg bg-canvas">
                {lyricLines.map((line, index) => {
                  const on = padLine === index;
                  return (
                    <li
                      key={`${index}-${line}`}
                      data-lyric-line={index}
                      className={cn(
                        "px-3 py-2 text-sm",
                        on ? "bg-bone text-bone-ink" : "text-muted",
                        !line.trim() && "text-faint",
                      )}
                    >
                      {line.trim() ? line : "—"}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <label className="sr-only" htmlFor="lyrics">
              Lyrics for {section?.name}
            </label>
            <textarea
              id="lyrics"
              value={section?.lyrics ?? ""}
              maxLength={4000}
              rows={5}
              onChange={(event) => setLyrics(event.target.value)}
              placeholder="Write a line for each chord"
              className="w-full resize-y rounded-lg border border-line bg-canvas px-3 py-3 text-sm text-ink"
            />
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Key" hint={keyLabel(keyRoot, mode)}>
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 12 }, (_, pc) => {
                const label = tonicName(pc, mode);
                const on = pc === keyRoot;
                return (
                  <button
                    key={pc}
                    type="button"
                    aria-pressed={on}
                    onClick={() => previewAfter(() => setKey(pc))}
                    className={chip(on, "h-11 px-0 text-sm")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {MODES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={item.id === mode}
                  onClick={() => previewAfter(() => setMode(item.id))}
                  className={chip(item.id === mode, "h-11 px-3 text-sm")}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Presets" hint="Transposes with the key">
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((preset) => {
                const on = sameChords(chords, preset.chords);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => previewAfter(() => applyPreset(preset.id))}
                    className={chip(on, "h-auto min-h-11 flex-col items-start px-3 py-2 text-left")}
                  >
                    <span className="text-sm font-medium">{preset.name}</span>
                    <span className={cn("text-xs", on ? "text-bone-muted" : "text-faint")}>{preset.hint}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title={`Editing ${selected?.symbol ?? ""}`} hint={selected?.roman}>
            <p className="mb-2 text-xs text-faint">In this scale</p>
            <div className="flex flex-wrap gap-2">
              {diatonic.map((choice) => (
                <Choice
                  key={`${choice.semitones}-${choice.quality}`}
                  on={selected?.semitones === choice.semitones && selected.quality === choice.quality}
                  label={choice.symbol}
                  detail={choice.roman}
                  onClick={() =>
                    previewAfter(() => patchSelected({ semitones: choice.semitones, quality: choice.quality }))
                  }
                />
              ))}
            </div>
            {borrowed.length > 0 ? (
              <>
                <p className="mt-4 mb-2 text-xs text-faint">Borrowed</p>
                <div className="flex flex-wrap gap-2">
                  {borrowed.map((choice) => (
                    <Choice
                      key={`${choice.semitones}-${choice.quality}`}
                      on={selected?.semitones === choice.semitones && selected.quality === choice.quality}
                      label={choice.symbol}
                      detail={choice.roman}
                      onClick={() =>
                        previewAfter(() => patchSelected({ semitones: choice.semitones, quality: choice.quality }))
                      }
                    />
                  ))}
                </div>
              </>
            ) : null}
            <p className="mt-4 mb-2 text-xs text-faint">Color</p>
            <div className="flex flex-wrap gap-2">
              {QUALITY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected?.quality === option.id}
                  onClick={() => previewAfter(() => patchSelected({ quality: option.id as Quality }))}
                  className={chip(selected?.quality === option.id, "h-11 px-3 text-sm")}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-4 mb-2 text-xs text-faint">Beats</p>
            <div className="grid grid-cols-6 gap-2">
              {BEAT_OPTIONS.map((beats) => (
                <button
                  key={beats}
                  type="button"
                  aria-pressed={selected?.beats === beats}
                  onClick={() => previewAfter(() => patchSelected({ beats }))}
                  className={chip(selected?.beats === beats, "h-11 px-0 text-sm tabular-nums")}
                >
                  {beats}
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <TextButton label="Earlier" onClick={() => moveSelected(-1)} disabled={!canMove(chords, selectedId, -1)} />
              <TextButton label="Later" onClick={() => moveSelected(1)} disabled={!canMove(chords, selectedId, 1)} />
              <TextButton label="Copy" onClick={() => previewAfter(duplicateSelected)} disabled={chords.length >= 32} />
              <TextButton label="Delete" onClick={deleteSelected} disabled={chords.length <= 1} />
            </div>
          </Section>

          <div className="flex flex-col gap-4">
            <Section title="Pattern" hint={instrument === "guitar" ? "Guitar" : "Keys"}>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["guitar", "Guitar"],
                    ["keys", "Keys"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={instrument === id}
                    onClick={() => previewAfter(() => setInstrument(id))}
                    className={chip(instrument === id, "h-11 px-3 text-sm")}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PATTERNS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={pattern === item.id}
                    onClick={() => previewAfter(() => setPattern(item.id as PatternId))}
                    className={chip(pattern === item.id, "h-11 px-2 text-sm")}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted">{patternMeta?.blurb}</p>
            </Section>

            <Section title="Library" hint="Saves sections and lyrics">
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveLoop(loopName);
                  setLoopName("");
                }}
              >
                <label className="sr-only" htmlFor="loop-name">
                  Loop name
                </label>
                <input
                  id="loop-name"
                  value={loopName}
                  maxLength={40}
                  onChange={(event) => setLoopName(event.target.value)}
                  placeholder="Name this song"
                  className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 text-sm text-ink"
                />
                <button
                  type="submit"
                  disabled={!loopName.trim()}
                  className="h-11 rounded-lg bg-raised px-4 text-sm font-medium text-ink"
                >
                  Save
                </button>
              </form>
              {saved.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Save the song to come back to the sections and lyrics.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {saved.map((item) => (
                    <li key={item.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => previewAfter(() => loadLoop(item.id))}
                        className="h-11 min-w-0 flex-1 truncate rounded-lg bg-raised px-3 text-left text-sm text-ink"
                      >
                        {item.name}
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${item.name}`}
                        onClick={() => deleteLoop(item.id)}
                        className="h-11 rounded-lg px-3 text-sm text-muted"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      </div>

      <footer className="deck-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={snap.playing ? "Pause" : "Play"}
              onClick={() => void engine.toggle()}
              className="grid size-14 shrink-0 place-items-center rounded-full bg-bone text-bone-ink transition-transform duration-150 active:scale-[0.98]"
            >
              {snap.playing ? <PauseMark /> : <PlayMark />}
            </button>
            <button
              type="button"
              aria-label="Start over"
              onClick={() => engine.reset()}
              disabled={!snap.playing && !snap.engaged}
              className="grid size-12 shrink-0 place-items-center rounded-full bg-raised text-ink"
            >
              <RotateCcw className="size-5" aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="text-sm font-medium tabular-nums">{bpm} BPM</p>
                <TapTempo onTempo={setBpm} />
              </div>
              <Slider.Root
                min={50}
                max={180}
                step={1}
                value={[bpm]}
                onValueChange={(value) => setBpm(value[0] ?? bpm)}
                className="relative flex h-11 w-full touch-none items-center select-none"
              >
                <Slider.Track className="relative h-1.5 grow rounded-full bg-canvas">
                  <Slider.Range className="absolute h-full rounded-full bg-bone" />
                </Slider.Track>
                <Slider.Thumb
                  aria-label="Tempo"
                  aria-valuetext={`${bpm} beats per minute`}
                  className="block size-6 rounded-full bg-bone"
                />
              </Slider.Root>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Toggle on={loop} label="Loop" onClick={() => setLoop(!loop)} />
            <Toggle on={metronome} label="Click" onClick={() => setMetronome(!metronome)} />
            <Toggle on={countIn} label="Count-in" onClick={() => setCountIn(!countIn)} />
            <p className="ml-auto hidden text-xs text-faint sm:block">Space plays · arrows move</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-panel p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-ink">{title}</h2>
        {hint ? <p className="text-xs text-faint">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function chip(on: boolean, extra: string) {
  return cn(
    "inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150",
    on ? "bg-bone text-bone-ink" : "bg-raised text-ink hover:bg-line",
    extra,
  );
}

function Choice({
  on,
  label,
  detail,
  onClick,
}: {
  on: boolean;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={chip(on, "h-12 min-w-14 flex-col px-3 leading-tight")}>
      <span className="text-sm">{label}</span>
      <span className={cn("text-xs", on ? "text-bone-muted" : "text-faint")}>{detail}</span>
    </button>
  );
}

function TextButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-11 rounded-lg bg-raised px-3 text-sm font-medium text-ink"
    >
      {label}
    </button>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "h-11 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
        on ? "bg-raised text-ink ring-1 ring-line ring-inset" : "text-faint hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

function TapTempo({ onTempo }: { onTempo: (bpm: number) => void }) {
  const taps = useRef<number[]>([]);
  return (
    <button
      type="button"
      onClick={() => {
        const now = performance.now();
        taps.current = [...taps.current, now].filter((tap) => now - tap < 2500).slice(-6);
        if (taps.current.length < 2) return;
        const gaps: number[] = [];
        for (let index = 1; index < taps.current.length; index += 1) {
          gaps.push(taps.current[index]! - taps.current[index - 1]!);
        }
        const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
        if (average > 0) onTempo(Math.round(60000 / average));
      }}
      className="h-11 rounded-lg px-3 text-sm text-muted"
    >
      Tap
    </button>
  );
}

function canMove(chords: { id: string }[], selectedId: string, direction: -1 | 1) {
  const index = chords.findIndex((chord) => chord.id === selectedId);
  const next = index + direction;
  return index >= 0 && next >= 0 && next < chords.length;
}

function PlayMark() {
  return (
    <svg viewBox="0 0 24 24" className="ml-0.5 size-6" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
    </svg>
  );
}

function PauseMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
      <path d="M7 5h3.2v14H7V5zm6.8 0H17v14h-3.2V5z" fill="currentColor" />
    </svg>
  );
}

