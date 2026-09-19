/* =========================================================================
   🎬 REVENUE SPIKE CARD 3D (V3 MASTER REPLICA)
   Exact 1:1 pixel match with reference video:
   - Imported Plus Jakarta Sans 900 typography
   - Natural line drawing pace (starts Jan 25, climbs, surges to peak at frame 105)
   - Wavy deckle paper edge with authentic SVG displacement
   - 3D camera lift from steep angle to eye-level float
   - Fading tracker dot at peak surge
   - Deep cinematic crimson vignette with macro lens depth-of-field blurs
   ========================================================================= */

import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { RevenueSpikeCardProps } from "./types";

export const RevenueSpikeCard3D: React.FC<RevenueSpikeCardProps> = ({
  metricLabel = "Gross Volume",
  startValue = 1046058,
  endValue = 1046658,
  currencyPrefix = "$",
  startPercentage = 306.57,
  endPercentage = 350.08,
  startDate = "Jan 25",
  endDate = "Jan 26",
  accentColor = "#E11D48", // Crimson red
  badgeBorderColor = "#FB7185",
  badgeBgColor = "#FFE4E6",
  bgDarkRed = "#120104",
  fontFamily = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ---------------------------------------------------------------------------
  // 1. 3D Camera & Card Lift Physics (Matches Reference Video F001 -> F030)
  // ---------------------------------------------------------------------------
  const liftSpring = spring({
    frame,
    fps,
    config: { damping: 17, stiffness: 80 },
  });

  // Starts steep (~36°) at bottom, rises up and levels to ~13.5°
  const cardRotX = interpolate(liftSpring, [0, 1], [36, 13.5]) + Math.sin(frame * 0.04) * 1.2;
  const cardRotY = interpolate(liftSpring, [0, 1], [-10, -5.5]) + Math.cos(frame * 0.035) * 1.0;
  const cardTranslateY = interpolate(liftSpring, [0, 1], [70, 0]) + Math.sin(frame * 0.045) * 4;
  const cardScale = interpolate(liftSpring, [0, 1], [0.91, 1.0]);
  const cardOpacity = interpolate(frame, [0, 10], [0.35, 1], { extrapolateRight: "clamp" });

  // Camera subtle push-in
  const cameraZoom = interpolate(frame, [0, 150], [0.99, 1.025], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ---------------------------------------------------------------------------
  // 2. Exact Natural Chart Drawing Timeline (Frames 12 -> 105)
  // ---------------------------------------------------------------------------
  const chartProgress = interpolate(frame, [12, 105], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.3, 0.05, 0.2, 1),
  });

  // Revenue Counter (Dynamic commas)
  const currentValue = Math.round(
    interpolate(chartProgress, [0, 1], [startValue, endValue], {
      easing: Easing.bezier(0.3, 0.05, 0.2, 1),
    })
  );
  const formattedValue = currentValue.toLocaleString("en-US");

  // Percentage Badge Counter
  const currentPercentage = interpolate(
    chartProgress,
    [0, 1],
    [startPercentage, endPercentage],
    { easing: Easing.bezier(0.3, 0.05, 0.2, 1) }
  ).toFixed(2);

  // Badge fade/pop in around frame 10 (as in reference video)
  const badgeOpacity = interpolate(frame, [6, 16], [0, 1], { extrapolateRight: "clamp" });
  const badgeScale = interpolate(
    spring({ frame: Math.max(0, frame - 6), fps, config: { damping: 13, stiffness: 150 } }),
    [0, 1],
    [0.75, 1]
  );

  // Tracker Dot: Visible while line is drawing, fades out at peak around frame 105-115
  const dotOpacity = interpolate(frame, [98, 112], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ---------------------------------------------------------------------------
  // 3. Exact Polyline Coordinates (Matches Reference Video Peak Surge)
  // ---------------------------------------------------------------------------
  const chartPoints = useMemo(
    () => [
      { x: 38, y: 150 },
      { x: 74, y: 150 },
      { x: 92, y: 134 },
      { x: 120, y: 147 },
      { x: 144, y: 126 },
      { x: 168, y: 140 },
      { x: 194, y: 134 },
      { x: 218, y: 125 },
      { x: 246, y: 126 },
      { x: 272, y: 102 },
      { x: 294, y: 122 },
      { x: 318, y: 118 },
      { x: 344, y: 106 },
      { x: 374, y: 118 },
      { x: 404, y: 88 },
      { x: 434, y: 100 },
      { x: 448, y: 104 },
      { x: 472, y: 44 }, // Dramatic Peak Surge
      { x: 502, y: 92 }, // Pullback settling
    ],
    []
  );

  const { polylineD, currentTip } = useMemo(() => {
    let d = `M ${chartPoints[0].x} ${chartPoints[0].y}`;
    let len = 0;
    const lengths: number[] = [0];

    for (let i = 1; i < chartPoints.length; i++) {
      const p1 = chartPoints[i - 1];
      const p2 = chartPoints[i];
      const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      len += segLen;
      lengths.push(len);
      d += ` L ${p2.x} ${p2.y}`;
    }

    const targetLen = chartProgress * len;
    let tip = { x: chartPoints[0].x, y: chartPoints[0].y };

    for (let i = 1; i < chartPoints.length; i++) {
      if (targetLen <= lengths[i]) {
        const prevLen = lengths[i - 1];
        const segLen = lengths[i] - prevLen;
        const segProgress = segLen > 0 ? (targetLen - prevLen) / segLen : 0;
        const p1 = chartPoints[i - 1];
        const p2 = chartPoints[i];
        tip = {
          x: p1.x + (p2.x - p1.x) * segProgress,
          y: p1.y + (p2.y - p1.y) * segProgress,
        };
        break;
      }
      if (i === chartPoints.length - 1) {
        tip = chartPoints[chartPoints.length - 1];
      }
    }

    return { polylineD: d, currentTip: tip };
  }, [chartPoints, chartProgress]);

  const areaD = useMemo(() => {
    return `${polylineD} L 502 150 L 38 150 Z`;
  }, [polylineD]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgDarkRed,
        fontFamily,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Google Font Embed */}
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800;900&display=swap');
        `}
      </style>

      {/* SVG DEFS: NOISE FILTER, WAVY PAPER EDGE, GRADIENTS */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          {/* Authentic Paper Deckle / Wavy Organic Edge Filter */}
          <filter id="deckleEdgeV3" x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.04"
              numOctaves="3"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="4.5"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          {/* Paper Micro-Texture Grain */}
          <filter id="paperNoiseV3">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves="4"
              result="fineNoise"
            />
            <feColorMatrix
              type="matrix"
              values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0.05 0"
            />
          </filter>

          {/* Soft Airbrushed Crimson Glow for Line Area */}
          <linearGradient id="softAreaGradV3" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.42" />
            <stop offset="50%" stopColor={accentColor} stopOpacity="0.16" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.0" />
          </linearGradient>

          {/* Reveal clip path */}
          <clipPath id="chartProgressClipV3">
            <rect x="0" y="0" width={currentTip.x} height="180" />
          </clipPath>
        </defs>
      </svg>

      {/* BACKGROUND: CINEMATIC WINE-RED VIGNETTE */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(circle at 50% 48%, #32040C 0%, #170105 55%, #080002 100%)
          `,
        }}
      />

      {/* Deep Ambient Background Bokeh Spheres */}
      <div
        style={{
          position: "absolute",
          top: "12%",
          left: "10%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, #DC262638 0%, transparent 70%)",
          filter: "blur(68px)",
          transform: `translate(${Math.cos(frame * 0.03) * 18}px, ${Math.sin(frame * 0.035) * 22}px)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "14%",
          right: "6%",
          width: 460,
          height: 460,
          borderRadius: "50%",
          background: "radial-gradient(circle, #B91C1C32 0%, transparent 70%)",
          filter: "blur(75px)",
          transform: `translate(${Math.sin(frame * 0.028) * 16}px, ${Math.cos(frame * 0.03) * 20}px)`,
          pointerEvents: "none",
        }}
      />

      {/* CAMERA VIEWPORT & 3D FLOATING CARD */}
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          perspective: 1200,
          transform: `scale(${cameraZoom})`,
        }}
      >
        {/* Card Container with Wavy Paper Deckle Filter */}
        <div
          style={{
            position: "relative",
            width: 840, // Perfectly sized to match reference video ratio
            opacity: cardOpacity,
            transform: `
              scale(${cardScale})
              translateY(${cardTranslateY}px)
              rotateX(${cardRotX}deg)
              rotateY(${cardRotY}deg)
              rotateZ(-1.8deg)
            `,
            transformStyle: "preserve-3d",
            filter: "url(#deckleEdgeV3)", // Authentic undulating paper edges
          }}
        >
          {/* Card Surface Inner */}
          <div
            style={{
              position: "relative",
              background: "#FBF9F5", // Authentic warm paper stock
              borderRadius: 36,
              padding: "44px 52px 38px 52px",
              boxSizing: "border-box",
              // Outer Red Specular Rim Glow + Deep Soft Drop Shadow
              boxShadow: `
                0 0 65px rgba(244, 63, 94, 0.48),
                0 0 130px rgba(225, 29, 72, 0.28),
                0 45px 85px rgba(0, 0, 0, 0.92),
                inset 0 1px 3px rgba(255, 255, 255, 0.95),
                inset 0 -1px 2px rgba(0, 0, 0, 0.05)
              `,
            }}
          >
            {/* Paper Texture Overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 36,
                filter: "url(#paperNoiseV3)",
                opacity: 0.85,
                pointerEvents: "none",
              }}
            />

            {/* Top Row: Metric Label + Hand-Crafted Growth Pill Badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: "#383838",
                  letterSpacing: "-0.02em",
                }}
              >
                {metricLabel}
              </span>

              {/* Pink / Red Growth Pill Badge */}
              <div
                style={{
                  opacity: badgeOpacity,
                  transform: `scale(${badgeScale})`,
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 15px",
                  borderRadius: 999,
                  background: badgeBgColor,
                  border: `1.8px solid ${badgeBorderColor}`,
                  boxShadow: "0 2px 8px rgba(225, 29, 72, 0.12)",
                }}
              >
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: accentColor,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {currentPercentage}%
                </span>
              </div>
            </div>

            {/* Hero Revenue Number ($1,046,058 -> $1,046,658) */}
            <div
              style={{
                fontSize: 88,
                fontWeight: 900,
                lineHeight: 1.05,
                color: "#181D26",
                letterSpacing: "-0.05em",
                marginBottom: 24,
              }}
            >
              {currencyPrefix}
              {formattedValue}
            </div>

            {/* Polyline Chart Container */}
            <div style={{ position: "relative", width: "100%", height: 215 }}>
              <svg
                viewBox="0 0 540 180"
                width="100%"
                height="100%"
                style={{ overflow: "visible" }}
              >
                {/* 6 Faint Vertical Day Lines */}
                {[105, 175, 245, 315, 385, 455].map((gx, i) => (
                  <line
                    key={i}
                    x1={gx}
                    y1={28}
                    x2={gx}
                    y2={150}
                    stroke="#DDE3EA"
                    strokeWidth="1.2"
                    strokeDasharray="2 3"
                    opacity="0.8"
                  />
                ))}

                {/* Hand-Drawn Organic Baseline Axis */}
                <path
                  d="M 36 150 Q 270 149.2 504 150"
                  fill="none"
                  stroke="#334155"
                  strokeWidth="2.0"
                  strokeLinecap="round"
                />

                {/* Soft Airbrushed Gradient Area Fill */}
                <path
                  d={areaD}
                  fill="url(#softAreaGradV3)"
                  clipPath="url(#chartProgressClipV3)"
                />

                {/* Main Red Polyline Graph (Organic marker ink line) */}
                <path
                  d={polylineD}
                  fill="none"
                  stroke={accentColor}
                  strokeWidth="3.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  clipPath="url(#chartProgressClipV3)"
                />

                {/* Pulsating Tracker Dot (Visibly draws, then fades out at peak) */}
                {chartProgress > 0.01 && dotOpacity > 0 && (
                  <g
                    transform={`translate(${currentTip.x}, ${currentTip.y})`}
                    style={{ opacity: dotOpacity }}
                  >
                    <circle
                      r={10}
                      fill={accentColor}
                      opacity={0.35 + Math.sin(frame * 0.28) * 0.2}
                    />
                    <circle r={5.2} fill={accentColor} />
                  </g>
                )}
              </svg>

              {/* Date Markers Below Axis */}
              <div
                style={{
                  position: "absolute",
                  bottom: 8,
                  left: 20,
                  right: 20,
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#334155",
                  letterSpacing: "-0.01em",
                }}
              >
                <span>{startDate}</span>
                <span>{endDate}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FOREGROUND MACRO LENS DEPTH-OF-FIELD BOKEH BLURS */}
      <div
        style={{
          position: "absolute",
          top: "-5%",
          left: "-8%",
          width: 480,
          height: 480,
          borderRadius: "50%",
          background: "radial-gradient(circle, #990B1870 0%, #66040F30 45%, transparent 75%)",
          filter: "blur(90px)",
          pointerEvents: "none",
          transform: `translate(${Math.sin(frame * 0.03) * 12}px, ${Math.cos(frame * 0.03) * 15}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-8%",
          right: "-10%",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "radial-gradient(circle, #88081465 0%, #55020B25 45%, transparent 75%)",
          filter: "blur(95px)",
          pointerEvents: "none",
          transform: `translate(${Math.cos(frame * 0.025) * 14}px, ${Math.sin(frame * 0.025) * 16}px)`,
        }}
      />
    </AbsoluteFill>
  );
};
