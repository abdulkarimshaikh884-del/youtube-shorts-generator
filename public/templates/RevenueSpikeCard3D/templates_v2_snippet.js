/* ============================================================
   ShortsCraft Templates v2 Snippet: Revenue Spike Card 3D
   Category: Finance & Economy (money)
   Add this snippet to `public/templates-v2.js` under Category 5 (money)
   ============================================================ */

T["revenue-spike-card-3d"] = {
  name: "Revenue Spike Card 3D",
  cat: "money",
  dark: true,
  accent: "#E11D48",
  badge: "FLAGSHIP 3D",
  desc: "Stripe & Shopify 3D floating torn-paper deckle revenue surge card with animated counter, glowing polyline spike, and macro depth blurs.",
  videoPreview: "/templates/RevenueSpikeCard3D/preview.mp4",
  thumbnail: "/templates/RevenueSpikeCard3D/thumbnail.png",
  componentFile: "RevenueSpikeCard3D.tsx",
  aspectRatio: "9:16",
  durationInFrames: 150,
  fps: 30,
  defaultProps: {
    metricLabel: "Gross Volume",
    startValue: 1046058,
    endValue: 1046658,
    currencyPrefix: "$",
    startPercentage: 306.57,
    endPercentage: 350.08,
    startDate: "Jan 25",
    endDate: "Jan 26",
    accentColor: "#E11D48",
    badgeBorderColor: "#FB7185",
    badgeBgColor: "#FFE4E6",
    bgDarkRed: "#120104"
  },
  schema: [
    { key: "metricLabel", label: "Metric Label", type: "text", default: "Gross Volume" },
    { key: "currencyPrefix", label: "Currency Prefix", type: "text", default: "$" },
    { key: "startValue", label: "Start Revenue Value", type: "number", default: 1046058 },
    { key: "endValue", label: "End Revenue Value", type: "number", default: 1046658 },
    { key: "startPercentage", label: "Start Growth %", type: "number", default: 306.57 },
    { key: "endPercentage", label: "End Growth %", type: "number", default: 350.08 },
    { key: "startDate", label: "Start Date", type: "text", default: "Jan 25" },
    { key: "endDate", label: "End Date", type: "text", default: "Jan 26" },
    { key: "accentColor", label: "Chart Accent Color", type: "color", default: "#E11D48" }
  ]
};
