import React from "react";
import { AbsoluteFill, Series, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { analyzeScript, totalFrames } from "./scenes";
import { THEMES } from "./theme";
import { Background } from "./Background";
import { KineticText } from "./KineticText";
import { camera, spotlight } from "./fx";

export type MainProps = { script: string; style: string; aspect: string };

export const MainVideo: React.FC<MainProps> = ({ script, style }) => {
  const { fps, width, height } = useVideoConfig();
  const theme = THEMES[style] || THEMES["paper-ink"];
  const scenes = analyzeScript(script, fps);
  const total = totalFrames(scenes);
  const frame = useCurrentFrame();
  const fontBase = (Math.min(width, height) / 1080) * 96;

  // active scene + boundaries for flash
  const bounds: number[] = [];
  let acc = 0, active = 0;
  for (let i = 0; i < scenes.length; i++) { bounds.push(acc); if (frame >= acc) active = i; acc += scenes[i].durationInFrames; }

  const muted = theme.light ? "rgba(0,0,0,.5)" : "rgba(255,255,255,.62)";
  const faint = theme.light ? "rgba(0,0,0,.12)" : "rgba(255,255,255,.14)";
  const flashColor = theme.light ? "#ffffff" : theme.accent;

  // nearest upcoming/last boundary flash
  let flash = 0;
  for (const b of bounds) { if (b > 0) flash = Math.max(flash, interpolate(frame, [b - 3, b, b + 7], [0, theme.light ? 0.6 : 0.28, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })); }

  return (
    <AbsoluteFill style={{ background: theme.base, fontFamily: theme.font }}>
      {/* camera push-in wraps background + scenes for cinematic life */}
      <AbsoluteFill style={{ transform: camera(frame, total, fps, theme.light ? 1.06 : 1.05), transformOrigin: "center center" }}>
        <Background theme={theme} />
        <AbsoluteFill style={spotlight(theme.accent)} />
        <Series>
          {scenes.map((s, i) => (
            <Series.Sequence key={i} durationInFrames={s.durationInFrames}>
              <AbsoluteFill style={{ display: "flex", alignItems: i % 3 === 1 ? "flex-start" : "center", justifyContent: "center", textAlign: i % 3 === 1 ? "left" : "center", padding: `${height * 0.12}px ${width * 0.085}px` }}>
                <KineticText scene={s} theme={theme} />
              </AbsoluteFill>
            </Series.Sequence>
          ))}
        </Series>
      </AbsoluteFill>

      {/* film grain + vignette */}
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.5) .5px,transparent .5px)", backgroundSize: "3px 3px", opacity: theme.light ? 0.04 : 0.05, mixBlendMode: theme.light ? "multiply" : "screen", transform: `translate(${(frame % 3) - 1}px, ${(frame % 2)}px)` }} />
      <AbsoluteFill style={{ boxShadow: theme.light ? "inset 0 0 300px rgba(0,0,0,.12)" : `inset 0 0 ${width / 3}px rgba(0,0,0,.55)`, pointerEvents: "none" }} />

      {/* white/accent flash at scene boundaries */}
      <AbsoluteFill style={{ background: flashColor, opacity: flash, mixBlendMode: theme.light ? "normal" : "screen", pointerEvents: "none" }} />

      {/* HUD */}
      <div style={{ position: "absolute", top: "5%", left: "50%", transform: "translateX(-50%)", padding: `${fontBase * 0.18}px ${fontBase * 0.42}px`, border: `1px solid ${faint}`, borderRadius: 999, background: theme.light ? "rgba(0,0,0,.04)" : "rgba(255,255,255,.07)", color: muted, font: `800 ${fontBase * 0.3}px/1 ${theme.font}`, letterSpacing: "0.16em", textTransform: "uppercase" }}>
        {theme.label}
      </div>
      <div style={{ position: "absolute", left: "50%", bottom: "6%", transform: "translateX(-50%)", display: "flex", gap: fontBase * 0.16 }}>
        {scenes.map((_, i) => (
          <div key={i} style={{ width: i === active ? fontBase * 0.6 : fontBase * 0.16, height: fontBase * 0.16, borderRadius: 99, background: i === active ? theme.accent : faint }} />
        ))}
      </div>
      <div style={{ position: "absolute", left: "5%", bottom: "6%", color: muted, font: `800 ${fontBase * 0.3}px/1 ${theme.font}` }}>{String(active + 1).padStart(2, "0")}</div>
      <div style={{ position: "absolute", right: "5%", bottom: "6%", color: muted, font: `700 ${fontBase * 0.28}px/1 ${theme.font}`, letterSpacing: "0.08em" }}>shortscraft.online</div>
      <div style={{ position: "absolute", left: 0, bottom: 0, height: Math.max(5, height / 240), width: `${interpolate(frame, [0, total], [0, 100], { extrapolateRight: "clamp" })}%`, background: `linear-gradient(90deg,${theme.accent},${theme.accent2})`, boxShadow: theme.light ? "none" : `0 0 ${width / 60}px ${theme.accent}` }} />
    </AbsoluteFill>
  );
};
