/* A small but real Lottie document: a text layer, a moving rectangle with a
   fill and a stroke, one expression, and one image that is not embedded.
   Hand-built so the tests do not depend on a file someone exported once. */
module.exports = function sample(opts = {}) {
  const w = opts.w || 1080, h = opts.h || 1920;
  return {
    v: "5.7.4", nm: "Sample hook", fr: 30, ip: 0, op: 90, w, h, ddd: 0,
    assets: [{ id: "img_0", w: 100, h: 100, u: "images/", p: "img_0.png", e: 0 }],
    fonts: { list: [{ fName: "Inter-Bold", fFamily: "Inter", fStyle: "Bold", ascent: 72, fPath: "https://fonts.example/inter.css", origin: 1 }] },
    layers: [
      {
        ddd: 0, ind: 1, ty: 5, nm: "Headline", sr: 1, ip: 0, op: 90, st: 0,
        ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [w / 2, h / 2, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
        t: {
          d: { k: [{ s: { s: 96, f: "Inter-Bold", t: "Stop scrolling", j: 2, tr: 0, lh: 110, ls: 0, fc: [1, 1, 1] }, t: 0 }] },
          p: {}, m: { g: 1, a: { a: 0, k: [0, 0] } }, a: []
        }
      },
      {
        ddd: 0, ind: 2, ty: 4, nm: "Bar", sr: 1, ip: 0, op: 90, st: 0,
        ks: {
          o: { a: 0, k: 100 }, r: { a: 0, k: 0, x: "var $bm_rt = time * 10;" },
          p: { a: 1, k: [{ t: 0, s: [w / 2, h * 0.7, 0], i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } }, { t: 89, s: [w / 2, h * 0.8, 0] }] },
          a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] }
        },
        shapes: [{
          ty: "gr", nm: "Rect",
          it: [
            { ty: "rc", d: 1, s: { a: 0, k: [600, 120] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 24 } },
            { ty: "fl", c: { a: 0, k: [0.145, 0.388, 0.922, 1] }, o: { a: 0, k: 100 }, r: 1 },
            { ty: "st", c: { a: 0, k: [1, 1, 1, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 4 } },
            { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }
          ]
        }]
      },
      { ddd: 0, ind: 3, ty: 2, nm: "Logo", refId: "img_0", sr: 1, ip: 0, op: 90, st: 0,
        ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [120, 120, 0] }, a: { a: 0, k: [50, 50, 0] }, s: { a: 0, k: [100, 100, 100] } } }
    ]
  };
};
