// Script analysis: divide a raw script into punchy scenes for motion graphics.
// Pure TS (no deps) so it can run in Remotion (browser bundle) AND in the website backend.

export type Scene = {
  text: string;
  lines: string[];      // 2-4 balanced lines for layout
  keyword: number;      // index (within flattened words) of the word to highlight
  durationInFrames: number;
};

export const DIMS: Record<string, [number, number]> = {
  "9:16": [1080, 1920],
  "16:9": [1920, 1080],
  "1:1": [1080, 1080],
  "4:5": [1080, 1350],
};

const MAX_WORDS = 12;

export function splitToLines(text: string, target: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  target = Math.max(1, Math.min(target, words.length));
  if (target === 1) return [words.join(" ")];
  const per = words.length / target;
  const lines: string[] = [];
  let start = 0;
  for (let i = 0; i < target; i++) {
    let end = i === target - 1 ? words.length : Math.round((i + 1) * per);
    if (end <= start) end = start + 1;
    lines.push(words.slice(start, end).join(" "));
    start = end;
  }
  return lines.filter(Boolean);
}

function keywordIndex(words: string[]): number {
  let ki = 0, kl = 2;
  words.forEach((w, i) => {
    const c = w.replace(/[^\wऀ-ॿ]/g, "");
    if (c.length > kl) { kl = c.length; ki = i; }
  });
  return ki;
}

export function analyzeScript(script: string, fps = 30): Scene[] {
  // strip section markers like [HOOK] [MAIN] [CTA] and === HEADERS ===
  const clean = String(script || "")
    .replace(/===[^=]*===/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();

  // sentence-ish split
  let parts = clean
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // break long sentences into <= MAX_WORDS chunks
  const chunks: string[] = [];
  for (const p of parts) {
    const w = p.split(/\s+/);
    if (w.length <= MAX_WORDS) chunks.push(p);
    else for (let i = 0; i < w.length; i += MAX_WORDS) chunks.push(w.slice(i, i + MAX_WORDS).join(" "));
  }

  // merge very short fragments into previous
  const merged: string[] = [];
  for (const s of chunks) {
    const prev = merged[merged.length - 1];
    if (prev && s.split(/\s+/).length <= 2 && prev.split(/\s+/).length < MAX_WORDS) {
      merged[merged.length - 1] = prev + " " + s;
    } else merged.push(s);
  }

  const scenes = merged.slice(0, 24).map((text): Scene => {
    const words = text.split(/\s+/).filter(Boolean);
    const target = words.length <= 4 ? 2 : words.length <= 8 ? 3 : 4;
    const dur = Math.min(150, Math.max(66, Math.round(words.length * 15)));
    return { text, lines: splitToLines(text, target), keyword: keywordIndex(words), durationInFrames: dur };
  });

  return scenes.length ? scenes : [{ text: "ShortsCraft", lines: ["ShortsCraft"], keyword: 0, durationInFrames: 90 }];
}

export function totalFrames(scenes: Scene[]): number {
  return scenes.reduce((a, s) => a + s.durationInFrames, 0) || 90;
}
