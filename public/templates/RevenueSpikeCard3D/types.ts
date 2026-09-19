import { z } from "zod";

export const RevenueSpikeCardSchema = z.object({
  metricLabel: z.string().default("Gross Volume"),
  startValue: z.number().default(1046525),
  endValue: z.number().default(1046658),
  currencyPrefix: z.string().default("$"),
  startPercentage: z.number().default(306.57),
  endPercentage: z.number().default(350.08),
  startDate: z.string().default("Jan 25"),
  endDate: z.string().default("Jan 26"),
  cardTheme: z.enum(["lightPaper", "darkGlass", "emerald"]).default("lightPaper"),
  accentColor: z.string().default("#E11D48"), // Crimson/Rose red
  badgeBorderColor: z.string().default("#FDA4AF"),
  badgeBgColor: z.string().default("#FFF1F2"),
  bgDarkRed: z.string().default("#160206"),
  fontFamily: z.string().default("'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif"),
});

export type RevenueSpikeCardProps = z.infer<typeof RevenueSpikeCardSchema>;
