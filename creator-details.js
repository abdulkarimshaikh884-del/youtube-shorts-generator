"use strict";
// Optional PUBLIC profile information. Never used for auth, permissions or KYC.
const TEXT = {creatorType:40,niche:80,languages:100,businessEmail:180};
const LINKS = {portfolio:null,telegram:["t.me","telegram.me"],x:["x.com","twitter.com"],linkedin:["linkedin.com"],tiktok:["tiktok.com"]};
function normalise(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {error:"Invalid creator details."};
  const value = {};
  for (const [key,max] of Object.entries(TEXT)) {
    const raw = input[key] ?? "";
    if (typeof raw !== "string" || raw.length > max || /[\u0000-\u001f\u007f]/.test(raw)) return {error:"Invalid " + key + "."};
    value[key] = raw.trim();
  }
  if (value.businessEmail && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.businessEmail)) return {error:"Enter a valid public business email."};
  if (value.creatorType && !["Video creator","Motion designer","Thumbnail designer","Educator","Agency / Studio","Other"].includes(value.creatorType)) return {error:"Choose a creator type from the list."};
  for (const [key,hosts] of Object.entries(LINKS)) {
    const raw = input[key] ?? "";
    if (typeof raw !== "string" || raw.length > 300) return {error:"Invalid " + key + " link."};
    value[key] = "";
    if (!raw.trim()) continue;
    try {
      const url = new URL(raw.trim());
      if (url.protocol !== "https:" || url.username || url.password || url.port || !url.hostname.includes(".")) throw new Error("url");
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      if (hosts && !hosts.includes(host)) throw new Error("host");
      value[key] = url.href;
    } catch { return {error:"Enter a valid HTTPS " + key + " link."}; }
  }
  return {value};
}
function publicDetails(input) { return normalise(input || {}).value || {}; }
module.exports = {normalise,publicDetails};
