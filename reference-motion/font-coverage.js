'use strict';

// Generated from the actual bundled Unicode cmap tables on 2026-10-19.
// Runtime is browser-safe: no filesystem, font loading, network or assumptions
// from Unicode script blocks. Tests reparse both SFNT assets and compare every
// mapped codepoint (glyph ID zero/.notdef is deliberately not coverage).
//
// Noto Sans Devanagari (SIL OFL 1.1), flagship/assets/FONT_PROVENANCE.md:
// SHA256 14ec4af41f27482216d1c2229f417ff9b1425e1babb014e57d1d40d03229853e
// Latin Modern Roman 10 Regular (GUST license), reference-motion/fonts/README.md:
// SHA256 1aa18cfefa58132c52ce5de70db1fd1154201c19cd2b2cdaffba4906a33e6852
const FONT_COVERAGE = Object.freeze({
  'noto-sans': Object.freeze([
    [13,13],[32,126],[160,163],[165,165],[167,171],[173,176],[180,180],[182,184],[186,187],[191,263],[266,275],[278,283],[286,291],[294,295],[298,299],[302,305],[310,311],[313,318],[321,328],[336,341],[344,347],[350,353],[356,357],[362,363],[366,382],[536,539],[567,567],[700,700],[710,711],[713,713],[728,733],[768,772],[774,776],[778,780],[806,808],[2304,2431],[7376,7414],[7416,7417],[7808,7813],[7838,7838],[7922,7923],[8203,8205],[8208,8208],[8211,8212],[8216,8218],[8220,8222],[8226,8226],[8230,8230],[8249,8250],[8364,8364],[8377,8377],[8432,8432],[8482,8482],[8722,8722],[9676,9676],[43056,43065],[43232,43263],[72448,72457],
  ].map(range => Object.freeze(range))),
  'latin-modern-roman': Object.freeze([
    [32,126],[160,311],[313,328],[330,357],[360,383],[398,398],[402,402],[416,417],[431,432],[461,468],[471,477],[486,487],[490,491],[496,496],[500,501],[506,513],[516,517],[520,521],[524,525],[528,529],[532,533],[536,539],[567,567],[600,601],[702,703],[710,711],[728,733],[768,772],[774,780],[783,783],[785,785],[803,803],[806,806],[814,818],[913,929],[931,937],[3647,3647],[7692,7695],[7716,7719],[7722,7723],[7726,7727],[7734,7737],[7746,7751],[7768,7773],[7778,7779],[7788,7791],[7808,7813],[7826,7827],[7831,7831],[7840,7929],[8208,8209],[8211,8212],[8214,8214],[8216,8218],[8220,8222],[8224,8226],[8230,8230],[8240,8241],[8249,8251],[8253,8253],[8255,8256],[8260,8262],[8274,8274],[8276,8276],[8353,8353],[8356,8356],[8358,8358],[8361,8361],[8363,8364],[8369,8369],[8451,8451],[8470,8471],[8478,8478],[8480,8480],[8482,8482],[8486,8487],[8494,8494],[8592,8595],[8722,8722],[8725,8725],[8727,8727],[8730,8730],[8734,8734],[8738,8738],[8960,8960],[9001,9002],[9250,9251],[9702,9702],[9834,9834],[9901,9902],[10214,10215],[59395,59395],[59904,59921],[59924,59935],[59941,59958],[59960,59974],[60162,60164],[60168,60170],[60173,60173],[60175,60178],[60181,60183],[60185,60185],[60190,60191],[60200,60203],[60206,60210],[60213,60214],[60218,60219],[60224,60224],[60227,60227],[60232,60233],[60236,60237],[60240,60247],[60250,60250],[60257,60257],[60259,60263],[60267,60267],[60270,60271],[60286,60286],[60416,60417],[60422,60430],[60432,60433],[63032,63041],[63043,63052],[63166,63166],[63196,63196],[63198,63198],[63268,63268],[63280,63289],[63394,63394],[64256,64260],
  ].map(range => Object.freeze(range))),
});
const FONT_METADATA = Object.freeze({
  'noto-sans': Object.freeze({sha256: '14ec4af41f27482216d1c2229f417ff9b1425e1babb014e57d1d40d03229853e', codepoints: 551, license: 'SIL-OFL-1.1'}),
  'latin-modern-roman': Object.freeze({sha256: '1aa18cfefa58132c52ce5de70db1fd1154201c19cd2b2cdaffba4906a33e6852', codepoints: 794, license: 'GUST-Font-License-1.0'}),
});

function hasCodepoint(ranges, codepoint) {
  let left = 0, right = ranges.length-1;
  while (left <= right) {
    const middle = (left+right) >>> 1, range = ranges[middle];
    if (codepoint < range[0]) right = middle-1;
    else if (codepoint > range[1]) left = middle+1;
    else return true;
  }
  return false;
}

function supportedText(content, font) {
  if (typeof content !== 'string' || content.length > 1024 || typeof font !== 'string' ||
      !Object.prototype.hasOwnProperty.call(FONT_COVERAGE, font) || content.split('\n').length > 20) return false;
  const ranges = FONT_COVERAGE[font];
  for (const character of content) {
    const codepoint = character.codePointAt(0);
    // LF is a controlled layout break, not a glyph. CR, TAB, other control
    // bytes and unpaired UTF-16 surrogates are never silently normalized away.
    if (codepoint === 10) continue;
    if (codepoint < 32 || codepoint === 127 || (codepoint >= 0xD800 && codepoint <= 0xDFFF) ||
        !hasCodepoint(ranges, codepoint)) return false;
  }
  return true;
}

function fontForText(content, preferred) {
  if (supportedText(content, preferred)) return preferred;
  // One real font must cover the whole string. In particular Latin + Hindi
  // uses the packaged Noto face; no OS/default-font or invisible-glyph fallback.
  for (const font of ['noto-sans', 'latin-modern-roman']) if (supportedText(content, font)) return font;
  return null;
}

module.exports = {supportedText, fontForText, FONT_COVERAGE, FONT_METADATA};
