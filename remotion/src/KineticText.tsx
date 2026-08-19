import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { Theme, Entrance } from "./theme";
import { Scene } from "./scenes";
import { enter, anticipate, floatY, EXPO } from "./fx";

const sizeCycle = ["hero", "lg", "md"] as const;

// per-word transform for a given entrance, p=0..1 settle progress
function entranceTransform(entrance: Entrance, p: number, fontBase: number): { opacity: number; transform: string; filter?: string } {
  switch (entrance) {
    case "up":
      return { opacity: p, transform: `translateY(${interpolate(p, [0, 1], [fontBase * 0.7, 0])}px)` };
    case "slide":
      return { opacity: p, transform: `translateX(${interpolate(p, [0, 1], [-fontBase * 0.6, 0])}px)` };
    case "pop": {
      const s = anticipate(p * 22, 0, 22, 1.08) || p; // reuse curve shape
      return { opacity: p, transform: `scale(${interpolate(p, [0, 0.7, 1], [0.4, 1.08, 1])})` };
    }
    case "blur":
      return { opacity: p, transform: `scale(${interpolate(p, [0, 1], [1.12, 1])})`, filter: `blur(${interpolate(p, [0, 1], [14, 0])}px)` };
    case "reveal":
    default:
      // PaperInk flat: clean bottom-to-top offset + fade, no blur/scale
      return { opacity: p, transform: `translateY(${interpolate(p, [0, 1], [fontBase * 0.42, 0])}px)` };
  }
}

export const KineticText: React.FC<{ scene: Scene; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const fontBase = (Math.min(width, height) / 1080) * 96;
  const sizeMap: Record<string, number> = { hero: fontBase * 1.85, lg: fontBase * 1.28, md: fontBase * 0.9 };

  let wIdx = 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: fontBase * 0.16, maxWidth: "92%", alignItems: "inherit" }}>
      {scene.lines.map((line, li) => {
        const words = line.split(/\s+/).filter(Boolean);
        const size = sizeMap[sizeCycle[li % sizeCycle.length]];
        return (
          <div key={li} style={{ lineHeight: 0.98, letterSpacing: "-0.02em", fontWeight: theme.weight, fontSize: size, wordBreak: "keep-all", textShadow: theme.light ? "none" : "0 6px 30px rgba(0,0,0,.35)" }}>
            {words.map((w, i) => {
              const gi = wIdx++;
              const delay = 6 + gi * 3;               // staggered arrival
              const p = enter(frame, delay, 16, EXPO); // fast launch -> settle
              const isKw = gi === scene.keyword;
              const et = entranceTransform(theme.entrance, p, fontBase);
              // idle micro-motion after settle so nothing freezes (no dead frames)
              const idle = p > 0.98 ? floatY(frame, fps, theme.flat ? 2 : 4, 4, gi) : 0;
              const kwColor = isKw ? theme.accent : theme.fg;
              const kwWeight = isKw && theme.flat ? 900 : theme.weight;
              return (
                <span key={i} style={{
                  display: "inline-block",
                  margin: "0.04em 0.06em",
                  color: kwColor,
                  fontWeight: kwWeight,
                  opacity: et.opacity,
                  transform: `${et.transform} translateY(${idle}px)`,
                  filter: et.filter,
                  textShadow: isKw && !theme.light ? `0 0 ${fontBase * 0.35}px ${theme.accent}88` : undefined,
                }}>
                  {w}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
