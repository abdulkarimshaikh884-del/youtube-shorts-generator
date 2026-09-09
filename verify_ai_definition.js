/* Offline regression tests for constrained, editable AI scenes. */
const fs = require("fs");
const vm = require("vm");
const anim = require("./animate");

let failures = 0;
function ok(pass, label, extra) {
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${extra ? "  (" + extra + ")" : ""}`);
}

const reply = {
  version: 2,
  name: "Claude comparison",
  theme: "midnight",
  accent: "#7c5cff",
  background: "aurora",
  transition: "zoom-through",
  scenes: [
    { layout: "kinetic-hero", eyebrow: "AI COMPARISON", title: "Claude vs ChatGPT", body: "Which assistant fits a creator workflow?", primary: "Two leaders", secondary: "One choice", items: [], entrance: "blur-rise" },
    { layout: "split-compare", eyebrow: "SIDE BY SIDE", title: "Different creative strengths", body: "Compare the workflows before choosing.", primary: "Claude", secondary: "ChatGPT", items: [], entrance: "slide-left" },
    { layout: "feature-grid", eyebrow: "YOUR PICK", title: "Choose for the job", body: "Match the tool to the work you do most.", primary: "Test both", secondary: "Keep the winner", items: ["Writing", "Research", "Ideation"], entrance: "spring" }
  ]
};

(async () => {
  console.log("\n---- approved vocabulary ----");
  ok(anim.VOCABULARY.version === 2, "story definition format is versioned");
  ok(anim.VOCABULARY.layouts.length === 10, "layout choices are broader but bounded", anim.VOCABULARY.layouts.join(", "));
  ok(anim.VOCABULARY.themes.length === 5, "theme choices are bounded");

  const prompt = anim.scenePrompt({ prompt: "Compare Claude and ChatGPT", dur: 4600, hasImage: false });
  ok(/2 to 4 sequential motion scenes/.test(prompt) && /layout MUST be one of/.test(prompt), "model prompt requires a multi-scene story from approved layouts");
  ok(/Never output HTML, CSS, React, JavaScript/.test(prompt), "model prompt explicitly forbids code");

  console.log("\n---- structured generation ----");
  const scene = await anim.generateScene({
    prompt: "Compare Claude and ChatGPT", dur: 4600, model: "offline-test",
    callModel: async () => "```json\n" + JSON.stringify(reply) + "\n```"
  });
  ok(scene.definition && scene.definition.version === 2 && scene.definition.scenes.length === 3, "valid storyboard compiles to three timed scenes");
  ok(/@keyframes/.test(scene.css) && !/<script/i.test(scene.body), "compiled scene is animated and script-free");
  ok((scene.body.match(/ai2-beat/g) || []).length === 3, "compiled body contains three story beats");
  ok(scene.schema && scene.schema.fields.length >= 18, "every beat exposes editable fields", scene.schema.fields.length);
  ok(/\{\{s1Title\}\}/.test(scene.body) && /\{\{s3Item1\}\}/.test(scene.body), "compiled body keeps per-scene editable placeholders");

  console.log("\n---- editability after generation ----");
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("public/templates-v2.js", "utf8"), context);
  const html = context.window.SC_TPL2.buildCustom(scene, {
    aspect: "16:9", dur: 4600,
    props: { s1Title: "Edited after AI", s2Primary: "New left choice", s3Item1: "Custom feature" }
  });
  ok(html.includes("Edited after AI") && html.includes("New left choice") && html.includes("Custom feature"), "edits from multiple beats reach preview/render HTML");
  ok(!/\{\{[A-Za-z]/.test(html), "no unresolved placeholders remain");

  console.log("\n---- invalid output and fallback normalization ----");
  const normalized = anim.normaliseStoryDefinition({
    name: "Test", theme: "invented", background: "video-url", transition: "explode",
    scenes: [{ layout: "freeform-webpage", title: "Safe fallback", entrance: "random-bounce" }]
  }, { prompt: "fallback" });
  ok(normalized.theme === "midnight" && normalized.background === "mesh-grid" && normalized.scenes[0].layout === "kinetic-hero",
    "unsupported theme/background/layout fall back to approved defaults");
  ok(normalized.transition === "crossfade" && normalized.scenes[0].entrance === "blur-rise" && normalized.scenes.length === 2,
    "unsupported motion falls back and a short reply receives a second beat");

  const legacy = anim.sanitise(anim.compileDefinition({
    version: 1, name: "Saved v1", theme: "midnight", layout: "comparison",
    content: { title: "Old draft", primary: "A", secondary: "B" }
  }));
  ok(legacy.definition.version === 1 && /\{\{title\}\}/.test(legacy.body), "saved version-1 AI drafts remain compatible");

  let codeRejected = "";
  try {
    await anim.generateScene({
      prompt: "make a card", dur: 4600,
      callModel: async () => JSON.stringify({ name: "code", css: ".x{}", body: "<div>x</div>" })
    });
  } catch (err) { codeRejected = err.message; }
  ok(/code instead of an approved scene definition/.test(codeRejected), "code-shaped model output is rejected", codeRejected);

  let jsonRejected = "";
  try {
    await anim.generateScene({ prompt: "make a card", dur: 4600, callModel: async () => "not json" });
  } catch (err) { jsonRejected = err.message; }
  ok(/did not return a scene definition/.test(jsonRejected), "non-JSON model output is rejected", jsonRejected);

  console.log(`\nAI_DEFINITION=${failures === 0 ? "PASS" : "FAIL"}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error("HARNESS FAIL:", err.message);
  process.exit(1);
});
