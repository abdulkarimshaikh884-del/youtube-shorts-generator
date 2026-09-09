/* ============================================================
   audit_css_conflicts.js — where the stylesheets fight each other.

   Three bugs tonight were all the same shape: two stylesheets set the
   same property on the same selector, both with !important, and each won
   one half — so a button ended up black text on a black fill, or white on
   white. Nothing rendered "wrong" enough to crash; it was simply
   unreadable, and only a person looking at that exact screen would know.

   This reads the CSS as text and reports:
     1. !important collisions  - the same selector+property forced by two
        different files, which is the pattern that produced every one of
        those bugs;
     2. selectors redefining the same property across files, ranked by how
        many files are involved;
     3. hard-coded near-white / near-black text colours still left in the
        light theme, which are the raw material for the next one.

   Static analysis, so it sees rules the browser never reaches too.

   Usage: node audit_css_conflicts.js
   ============================================================ */
const fs = require("fs");
const path = require("path");

const FILES = ["shell.css", "page.css", "editor.css", "redesign.css", "polish.css"]
  .map((f) => path.join("public", f))
  .filter((f) => fs.existsSync(f));

/* Strips comments, then walks brace depth so rules nested inside @media are
   still attributed to their own selector rather than to the query. */
function rules(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  let buf = "", depth = 0, selector = "";
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === "{") {
      depth++;
      if (depth === 1) { selector = buf.trim(); buf = ""; }
      else buf += ch;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        if (selector && !selector.startsWith("@")) out.push({ selector, body: buf });
        buf = "";
      } else if (depth > 0) {
        // closing an inner rule inside @media — record it
        const m = /([^{}]*)\{([^{}]*)$/.exec(buf);
        if (m && m[1].trim() && !m[1].trim().startsWith("@")) {
          out.push({ selector: m[1].trim(), body: m[2], inAtRule: true });
          buf = buf.slice(0, m.index);
        } else buf += ch;
      }
    } else buf += ch;
  }
  return out;
}

function decls(body) {
  return body.split(";").map((d) => d.trim()).filter(Boolean).map((d) => {
    const i = d.indexOf(":");
    if (i < 0) return null;
    return {
      prop: d.slice(0, i).trim().toLowerCase(),
      value: d.slice(i + 1).trim(),
      important: /!important\s*$/i.test(d)
    };
  }).filter(Boolean);
}

// selector|prop -> [{file, value, important}]
const index = new Map();
const hardCoded = [];

for (const file of FILES) {
  const name = path.basename(file);
  const css = fs.readFileSync(file, "utf8");
  for (const r of rules(css)) {
    for (const sel of r.selector.split(",").map((s) => s.trim()).filter(Boolean)) {
      for (const d of decls(r.body)) {
        const key = `${sel}||${d.prop}`;
        if (!index.has(key)) index.set(key, []);
        index.get(key).push({ file: name, value: d.value, important: d.important });

        /* A literal near-white or near-black text colour is what the theme
           tokens exist to prevent; each one is a future white-on-white. */
        if (d.prop === "color" && name !== "editor.css") {
          const v = d.value.toLowerCase();
          if (/^#(fff|ffffff|000|000000)\b/.test(v) || /^(white|black)\b/.test(v)) {
            hardCoded.push({ file: name, sel, value: d.value });
          }
        }
      }
    }
  }
}

console.log("CSS CONFLICT AUDIT");
console.log("=".repeat(78));
console.log(`files: ${FILES.map((f) => path.basename(f)).join(", ")}\n`);

// 1. !important collisions — the pattern behind tonight's bugs.
const wars = [];
for (const [key, list] of index) {
  const imps = list.filter((d) => d.important);
  const files = new Set(imps.map((d) => d.file));
  if (imps.length >= 2 && files.size >= 2) {
    const [sel, prop] = key.split("||");
    wars.push({ sel, prop, list: imps });
  }
}
console.log(`1. !important fights (same selector, same property, two files): ${wars.length}`);
wars.slice(0, 20).forEach((w) => {
  console.log(`   ${w.sel}  {${w.prop}}`);
  w.list.forEach((d) => console.log(`       ${d.file.padEnd(14)} ${d.value}`));
});

// 2. Properties redefined across three or more files.
const spread = [];
for (const [key, list] of index) {
  const files = new Set(list.map((d) => d.file));
  if (files.size >= 3) {
    const [sel, prop] = key.split("||");
    spread.push({ sel, prop, files: [...files], values: list.map((d) => `${d.file}:${d.value}`) });
  }
}
console.log(`\n2. Same selector+property set in 3+ files: ${spread.length}`);
spread.slice(0, 12).forEach((s) => {
  console.log(`   ${s.sel}  {${s.prop}}  ->  ${s.values.join("  |  ")}`);
});

// 3. Literal black/white text colours still in the themed stylesheets.
console.log(`\n3. Hard-coded #fff / #000 text colours outside the editor: ${hardCoded.length}`);
const byFile = {};
hardCoded.forEach((h) => { (byFile[h.file] = byFile[h.file] || []).push(h.sel); });
Object.entries(byFile).forEach(([f, sels]) => {
  console.log(`   ${f}: ${sels.length}`);
  [...new Set(sels)].slice(0, 8).forEach((s) => console.log(`       ${s}`));
});

console.log(`\n${wars.length === 0 ? "No !important fights." : wars.length + " fight(s) to resolve."}`);
process.exit(0);
