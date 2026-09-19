# 🚀 RevenueSpikeCard3D — Website Upload & Distribution Package
**Tier 1: Flagship 3D & Physical Motion Graphics (Stripe & Shopify 3D Revenue Surge)**

---

## 📦 Package Folder Contents (फ़ोल्डर में क्या-क्या है)

| File Name | Description | Purpose |
| :--- | :--- | :--- |
| 🎬 **`preview.mp4`** | 1080×1920 (9:16) HD Rendered Video (1.55 MB) | Website preview video / showcase reel |
| 🖼️ **`thumbnail.png`** | High-Res Keyframe Poster (Frame 115) | Website template card cover / poster image |
| 🖼️ **`thumbnail_f18.png`** | 3D Camera Entry Angle Poster | Gallery thumbnail |
| 🖼️ **`thumbnail_f55.png`** | Chart Mid-Surge Poster | Gallery thumbnail |
| 🖼️ **`thumbnail_f115.png`** | Peak Surge with Glowing Badge Poster | Gallery thumbnail |
| ⚙️ **`template.json`** | Structured Template Metadata & Schema | Auto-generation of website editor controls & props form |
| ⚛️ **`RevenueSpikeCard3D.tsx`** | Remotion Master React Component | Native Remotion rendering component with typed props |
| 📐 **`types.ts`** | Zod Schema & TypeScript Interfaces | Parameter validation & typing |
| 🌐 **`SceneIFrame.tsx`** | Standalone IFrame Web Runner | Sandboxed browser player runner (ShortsCraft / AutoAE) |
| 📋 **`templates_v2_snippet.js`** | Ready Code for `templates-v2.js` | Direct copy-paste into ShortsCraft template catalog |
| 💻 **`standalone_preview.html`** | Offline Double-Click Preview Dashboard | Instant local testing and client demo in any browser |

---

## 🌐 Website Par Upload Kaise Kare (How to Upload & Integrate)

### Method 1: ShortsCraft Platform Integration (Direct Web App)
Agar aap is template ko apne **ShortsCraft / AutoAE** website platform (`shortscraft`) par add karna chahte hain:

1. **Copy folder to public directory:**
   Is pure `RevenueSpikeCard3D` folder ko copy karke ShortsCraft ke public templates directory me daalein:
   ```bash
   cp -r "c:\Users\karim\kiroai\remotion\exports\RevenueSpikeCard3D" "c:\Users\karim\kiroai\shortscraft\public\templates\RevenueSpikeCard3D"
   ```

2. **Add to `templates-v2.js`:**
   `templates_v2_snippet.js` ke content ko copy karein aur `shortscraft/public/templates-v2.js` ke Category 5 (`money`) section me paste kar dein:
   ```javascript
   T["revenue-spike-card-3d"] = {
     name: "Revenue Spike Card 3D",
     cat: "money",
     dark: true,
     accent: "#E11D48",
     badge: "FLAGSHIP 3D",
     desc: "Stripe & Shopify 3D floating torn-paper deckle revenue surge card with animated counter, glowing polyline spike, and macro depth blurs.",
     videoPreview: "/templates/RevenueSpikeCard3D/preview.mp4",
     thumbnail: "/templates/RevenueSpikeCard3D/thumbnail.png",
     aspectRatio: "9:16",
     durationInFrames: 150,
     fps: 30,
     defaultProps: { ... }
   };
   ```

---

### Method 2: Remotion Project Me Use Karna
Agar aap kisi Remotion project me use kar rahe hain:

1. Files ko apne Remotion components folder me copy karein:
   - `RevenueSpikeCard3D.tsx`
   - `types.ts`

2. Apne `Root.tsx` me register karein:
   ```tsx
   import { Composition } from "remotion";
   import { RevenueSpikeCard3D } from "./RevenueSpikeCard3D";
   import { RevenueSpikeCardSchema } from "./types";

   export const RemotionRoot: React.FC = () => {
     return (
       <Composition
         id="RevenueSpikeCard3D"
         component={RevenueSpikeCard3D}
         schema={RevenueSpikeCardSchema}
         durationInFrames={150}
         fps={30}
         width={1080}
         height={1920}
         defaultProps={{
           metricLabel: "Gross Volume",
           startValue: 1046058,
           endValue: 1046658,
           currencyPrefix: "$",
           startPercentage: 306.57,
           endPercentage: 350.08,
           startDate: "Jan 25",
           endDate: "Jan 26",
           accentColor: "#E11D48",
         }}
       />
     );
   };
   ```

3. Render command:
   ```bash
   npx remotion render RevenueSpikeCard3D out/revenue_spike_card.mp4
   ```

---

## 🎨 Customizable Parameters (Editable Props)

Users ya creators aapki website par in parameters ko customize kar sakte hain:

| Prop Name | Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `metricLabel` | `string` | `"Gross Volume"` | Header title (e.g., "Total Revenue", "MRR", "Gross Volume") |
| `currencyPrefix` | `string` | `"$"` | Currency symbol (`$`, `₹`, `€`, `£`, etc.) |
| `startValue` | `number` | `1046058` | Starting counter number (e.g., $1,046,058) |
| `endValue` | `number` | `1046658` | Ending counter number (e.g., $1,046,658) |
| `startPercentage`| `number` | `306.57` | Initial percentage growth |
| `endPercentage` | `number` | `350.08` | Final peak percentage growth (`+350.08%`) |
| `startDate` | `string` | `"Jan 25"` | X-axis start date |
| `endDate` | `string` | `"Jan 26"` | X-axis peak date |
| `accentColor` | `string` | `"#E11D48"` | Chart stroke & primary accent color |
| `badgeBorderColor`| `string`| `"#FB7185"` | Badge glowing border color |
| `badgeBgColor` | `string` | `"#FFE4E6"` | Badge light pill background |
| `bgDarkRed` | `string` | `"#120104"` | Cinematic dark background vignette color |

---

## ✨ Signature Motion Physics Features
- **Organic Deckle Torn-Paper Edge:** SVG displacement filter `#deckleEdgeV3` with real turbulence frequency creates physical handcrafted paper edges.
- **Dynamic 3D Camera Lift:** Rises smoothly from a steep 36° entry angle to a leveled 13.5° eye-level float with spring physics.
- **Natural Polyline Surge:** Multi-segmented SVG path drawing calibrated to surge dramatically toward the end.
- **Disappearing Dot:** Glowing dot leads the line and smoothly fades out upon peak surge completion.
- **Cinematic Depth-of-Field:** Layered macro bokeh blurs and dark crimson radial vignette.

---
© ShortsCraft Motion Graphics Engine | Tier 1 Flagship 3D Series
