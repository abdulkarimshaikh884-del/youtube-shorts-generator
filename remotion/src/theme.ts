// The 5 curated, viral-ready styles. PaperInk is the approved flagship.
export type Entrance = "up" | "slide" | "pop" | "blur" | "reveal";
export type BgKind = "paper" | "viral" | "cyber" | "luxury" | "pop";

export type Theme = {
  id: string;
  label: string;
  bg: BgKind;
  base: string;
  fg: string;
  accent: string;
  accent2: string;
  font: string;
  weight: number;
  entrance: Entrance;
  light?: boolean;
  flat?: boolean; // flat premium text (no glow) — PaperInk
};

const POPPINS = "'Poppins','Inter','Noto Sans Devanagari','Nirmala UI',sans-serif";

export const THEMES: Record<string, Theme> = {
  "paper-ink": {
    id: "paper-ink", label: "🖋️ Paper Ink", bg: "paper",
    base: "#F5F5F3", fg: "#141414", accent: "#141414", accent2: "#7a7a7a",
    font: POPPINS, weight: 800, entrance: "reveal", light: true, flat: true,
  },
  "viral-hook": {
    id: "viral-hook", label: "🔥 Viral Hook", bg: "viral",
    base: "#0a0006", fg: "#ffffff", accent: "#ff2d6e", accent2: "#ffb02e",
    font: "'Inter','Arial Black',Impact,'Noto Sans Devanagari','Nirmala UI',sans-serif",
    weight: 900, entrance: "pop",
  },
  "neon-cyber": {
    id: "neon-cyber", label: "⚡ Neon Cyber", bg: "cyber",
    base: "#03040f", fg: "#eaffff", accent: "#00f5ff", accent2: "#b44fff",
    font: "'Inter','Arial Black','Noto Sans Devanagari','Nirmala UI',sans-serif",
    weight: 900, entrance: "slide",
  },
  "luxury-gold": {
    id: "luxury-gold", label: "👑 Luxury Gold", bg: "luxury",
    base: "#080600", fg: "#f7e7a0", accent: "#e8c66a", accent2: "#fff6c7",
    font: "'Fraunces',Georgia,'Times New Roman','Noto Sans Devanagari',serif",
    weight: 800, entrance: "reveal",
  },
  "social-pop": {
    id: "social-pop", label: "🌈 Social Pop", bg: "pop",
    base: "#7c3aed", fg: "#ffffff", accent: "#fff200", accent2: "#ffffff",
    font: "'Inter','Arial Black','Noto Sans Devanagari','Nirmala UI',sans-serif",
    weight: 950, entrance: "pop",
  },
};

export const STYLE_LIST = Object.values(THEMES).map((t) => ({ id: t.id, label: t.label }));
