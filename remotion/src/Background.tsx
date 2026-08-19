import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { Theme } from "./theme";
import { breathe } from "./fx";

const orb = (color: string, size: string, x: string, y: string, dx: number, dy: number, frame: number, speed: number) => {
  const tx = Math.sin((frame / speed) * Math.PI * 2) * dx;
  const ty = Math.cos((frame / speed) * Math.PI * 2) * dy;
  return {
    position: "absolute" as const, width: size, height: size, left: x, top: y,
    borderRadius: "50%", background: `radial-gradient(circle, ${color}, transparent 70%)`,
    filter: "blur(60px)", transform: `translate(${tx}px, ${ty}px)`, mixBlendMode: "screen" as const,
  };
};

export const Background: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  if (theme.bg === "paper") {
    const b = breathe(frame, fps, 0.015, 6);
    return (
      <AbsoluteFill style={{ background: "#F5F5F3" }}>
        <div style={{
          position: "absolute", inset: "-4%",
          backgroundImage: "radial-gradient(rgba(0,0,0,0.14) 1.6px, transparent 1.6px)",
          backgroundSize: "44px 44px",
          transform: `scale(${b})`,
          maskImage: "radial-gradient(circle at 50% 50%, black 0%, transparent 42%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 0%, transparent 42%)",
        }} />
      </AbsoluteFill>
    );
  }

  if (theme.bg === "viral") {
    return (
      <AbsoluteFill style={{ background: `radial-gradient(circle at 25% 15%,#3a0018,transparent 55%),radial-gradient(circle at 80% 85%,#2a0030,transparent 55%),linear-gradient(160deg,#0a0006,#16000c 55%,#08000d)` }}>
        <div style={orb(theme.accent, "55%", "-10%", "-8%", 40, 30, frame, 130)} />
        <div style={orb(theme.accent2, "48%", "62%", "60%", -35, 40, frame, 160)} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(#fff 1px,transparent 1px)", backgroundSize: "3px 3px", opacity: 0.06 }} />
        <div style={{ position: "absolute", left: "-20%", width: "160%", height: height / 8, top: "18%", transform: `rotate(-14deg) translateX(${interpolate(frame % 120, [0, 120], [-60, 60])}px)`, background: `linear-gradient(90deg,transparent,${theme.accent}55,transparent)`, filter: "blur(8px)", opacity: 0.4 }} />
      </AbsoluteFill>
    );
  }

  if (theme.bg === "cyber") {
    const gy = (frame % 60) / 60;
    return (
      <AbsoluteFill style={{ background: `radial-gradient(circle at 20% 20%,#06253a,transparent 55%),radial-gradient(circle at 82% 78%,#2a0a4a,transparent 55%),#03040f` }}>
        <div style={{ position: "absolute", left: "-20%", right: "-20%", bottom: "-10%", height: "80%", backgroundImage: `linear-gradient(rgba(0,245,255,.22) 1px,transparent 1px),linear-gradient(90deg,rgba(0,245,255,.22) 1px,transparent 1px)`, backgroundSize: `${width / 12}px ${width / 12}px`, backgroundPositionY: `${gy * (width / 12)}px`, transform: "perspective(600px) rotateX(62deg)", transformOrigin: "center top", maskImage: "linear-gradient(180deg,#000,transparent)" }} />
        <div style={orb(theme.accent, "42%", "-8%", "-6%", 30, 20, frame, 150)} />
        <div style={orb(theme.accent2, "40%", "66%", "8%", -25, 25, frame, 170)} />
      </AbsoluteFill>
    );
  }

  if (theme.bg === "luxury") {
    const rot = (frame / 300) * 360;
    return (
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 22%,#3a2e10,transparent 55%),linear-gradient(150deg,#080600,#161006 55%,#0a0800)` }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", width: "160%", height: "160%", transform: `translate(-50%,-50%) rotate(${rot}deg)`, background: "conic-gradient(from 0deg,transparent 0 12deg,rgba(232,198,106,.10) 12deg 18deg,transparent 18deg 30deg)", opacity: 0.7 }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(${theme.accent} 1px,transparent 2px)`, backgroundSize: `${width / 14}px ${width / 14}px`, opacity: 0.16 }} />
        <div style={{ position: "absolute", left: "50%", top: "50%", width: "78%", height: "78%", transform: `translate(-50%,-50%) rotate(${-rot}deg)`, border: "2px solid rgba(232,198,106,.18)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 ${width / 4}px #000` }} />
      </AbsoluteFill>
    );
  }

  // pop
  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg,#7c3aed,#ec4899 48%,#fb7185)` }}>
      <div style={{ ...orb("#ffffff", "50%", "-8%", "6%", 30, 24, frame, 120), opacity: 0.35 }} />
      <div style={{ ...orb("#fff200", "44%", "64%", "58%", -30, 30, frame, 140), opacity: 0.3 }} />
      {[0, 1, 2, 3].map((i) => {
        const yy = ((frame * 1.2 + i * 400) % (height + 200)) - 100;
        return <div key={i} style={{ position: "absolute", left: `${12 + i * 22}%`, top: yy, width: 90 + i * 30, height: 90 + i * 30, borderRadius: "50%", background: "rgba(255,255,255,.16)", filter: "blur(2px)" }} />;
      })}
    </AbsoluteFill>
  );
};
