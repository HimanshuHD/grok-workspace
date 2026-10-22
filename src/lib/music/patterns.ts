import type { PatternId } from "@/lib/music/theory";

export type Hit = {
  voices: number[];
  stagger: "down" | "up" | "none";
  velocity: number;
  holdEighths: number;
};

function range(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

export function hitsAt(pattern: PatternId, eighth: number, voiceCount: number): Hit[] {
  if (voiceCount <= 0) return [];
  const all = range(voiceCount);
  const bass = [0];
  const upper = all.filter((index) => index !== 0);
  const tops = upper.length ? upper : all;

  switch (pattern) {
    case "sustain":
      return eighth === 0 ? [{ voices: all, stagger: "down", velocity: 0.84, holdEighths: 64 }] : [];
    case "pulse":
      return eighth % 2 === 0
        ? [{ voices: all, stagger: "none", velocity: eighth === 0 ? 0.8 : 0.68, holdEighths: 1.7 }]
        : [];
    case "strum":
      return eighth % 2 === 0
        ? [{ voices: all, stagger: "down", velocity: eighth === 0 ? 0.9 : 0.74, holdEighths: 1.8 }]
        : [];
    case "folk": {
      const step = eighth % 8;
      const table: Record<number, { stagger: "down" | "up"; velocity: number }> = {
        0: { stagger: "down", velocity: 0.9 },
        2: { stagger: "down", velocity: 0.72 },
        3: { stagger: "up", velocity: 0.58 },
        5: { stagger: "up", velocity: 0.52 },
        6: { stagger: "down", velocity: 0.74 },
        7: { stagger: "up", velocity: 0.56 },
      };
      const hit = table[step];
      return hit ? [{ voices: all, stagger: hit.stagger, velocity: hit.velocity, holdEighths: 2.4 }] : [];
    }
    case "waltz": {
      if (eighth % 2 !== 0) return [];
      const beatInThree = Math.floor(eighth / 2) % 3;
      if (beatInThree === 0) return [{ voices: bass, stagger: "none", velocity: 0.86, holdEighths: 2 }];
      return [{ voices: tops, stagger: "down", velocity: 0.6, holdEighths: 1.8 }];
    }
    case "arpup":
      return [
        {
          voices: [eighth % voiceCount],
          stagger: "none",
          velocity: 0.72,
          holdEighths: 3,
        },
      ];
    case "arpdown":
      return [
        {
          voices: [voiceCount - 1 - (eighth % voiceCount)],
          stagger: "none",
          velocity: 0.72,
          holdEighths: 3,
        },
      ];
    case "finger": {
      const high = voiceCount - 1;
      const mid = Math.max(0, voiceCount - 2);
      const fifth = Math.min(1, voiceCount - 1);
      const order = [0, high, mid, high, fifth, high, mid, high];
      const index = order[eighth % 8] ?? 0;
      return [
        {
          voices: [Math.min(voiceCount - 1, index)],
          stagger: "none",
          velocity: eighth % 4 === 0 ? 0.82 : 0.62,
          holdEighths: 2.6,
        },
      ];
    }
    case "offbeat":
      return eighth % 2 === 1
        ? [{ voices: all, stagger: "down", velocity: 0.7, holdEighths: 1 }]
        : [];
    default:
      return [];
  }
}
