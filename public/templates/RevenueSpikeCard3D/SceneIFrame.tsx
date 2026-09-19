// =========================================================================
// 🚀 RevenueSpikeCard3D — Standalone 'Scene' Component for IFrame Player
// Compatible with ShortsCraft / AutoAE Web Player & Native Remotion
// 150 frames @ 30fps = 5.0 seconds | 1080x1920 (9:16 Vertical)
// =========================================================================

const SCENE_PARAMS = {
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
  bgDarkRed: "#140104",
};

const Scene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const liftSpring = spring({ frame, fps, config: { damping: 16, stiffness: 95 } });
  const cardRotX = interpolate(liftSpring, [0, 1], [38, 14.5]) + Math.sin(frame * 0.04) * 1.4;
  const cardRotY = interpolate(liftSpring, [0, 1], [-12, -6.5]) + Math.cos(frame * 0.035) * 1.2;
  const cardTranslateY = interpolate(liftSpring, [0, 1], [75, 0]) + Math.sin(frame * 0.045) * 4.5;
  const cardScale = interpolate(liftSpring, [0, 1], [0.89, 1.0]);
  const cardOpacity = interpolate(frame, [0, 8], [0.4, 1], { extrapolateRight: "clamp" });

  const cameraZoom = interpolate(frame, [0, 150], [0.99, 1.025], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const chartProgress = interpolate(frame, [10, 108], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.18, 0.82, 0.22, 1),
  });

  const currentValue = Math.round(
    interpolate(chartProgress, [0, 1], [SCENE_PARAMS.startValue, SCENE_PARAMS.endValue], {
      easing: Easing.bezier(0.18, 0.82, 0.22, 1),
    })
  );
  const formattedValue = currentValue.toLocaleString("en-US");

  const currentPercentage = interpolate(
    chartProgress,
    [0, 1],
    [SCENE_PARAMS.startPercentage, SCENE_PARAMS.endPercentage],
    { easing: Easing.bezier(0.18, 0.82, 0.22, 1) }
  ).toFixed(2);

  const badgeOpacity = interpolate(frame, [8, 18], [0, 1], { extrapolateRight: "clamp" });
  const badgeScale = interpolate(
    spring({ frame: Math.max(0, frame - 8), fps, config: { damping: 12, stiffness: 160 } }),
    [0, 1],
    [0.75, 1]
  );

  const dotOpacity = interpolate(frame, [100, 114], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const chartPoints = [
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
    { x: 472, y: 44 },
    { x: 502, y: 92 },
  ];

  let polylineD = `M ${chartPoints[0].x} ${chartPoints[0].y}`;
  let totalLength = 0;
  const lengths = [0];

  for (let i = 1; i < chartPoints.length; i++) {
    const p1 = chartPoints[i - 1];
    const p2 = chartPoints[i];
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    totalLength += segLen;
    lengths.push(totalLength);
    polylineD += ` L ${p2.x} ${p2.y}`;
  }

  const targetLen = chartProgress * totalLength;
  let currentTip = { x: chartPoints[0].x, y: chartPoints[0].y };

  for (let i = 1; i < chartPoints.length; i++) {
    if (targetLen <= lengths[i]) {
      const prevLen = lengths[i - 1];
      const segLen = lengths[i] - prevLen;
      const segProgress = segLen > 0 ? (targetLen - prevLen) / segLen : 0;
      const p1 = chartPoints[i - 1];
      const p2 = chartPoints[i];
      currentTip = {
        x: p1.x + (p2.x - p1.x) * segProgress,
        y: p1.y + (p2.y - p1.y) * segProgress,
      };
      break;
    }
    if (i === chartPoints.length - 1) {
      currentTip = chartPoints[chartPoints.length - 1];
    }
  }

  const areaD = `${polylineD} L 502 150 L 38 150 Z`;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: SCENE_PARAMS.bgDarkRed,
        fontFamily: "'Roboto', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id="deckleEdge" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="paperNoise">
            <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" result="fineNoise" />
            <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0.05 0" />
          </filter>
          <linearGradient id="softAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SCENE_PARAMS.accentColor} stopOpacity="0.4" />
            <stop offset="45%" stopColor={SCENE_PARAMS.accentColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={SCENE_PARAMS.accentColor} stopOpacity="0.0" />
          </linearGradient>
          <clipPath id="chartProgressClip">
            <rect x="0" y="0" width={currentTip.x} height="180" />
          </clipPath>
        </defs>
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 50% 46%, #33040C 0%, #170105 55%, #080002 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "14%",
          left: "12%",
          width: 380,
          height: 380,
          borderRadius: "50%",
          background: "radial-gradient(circle, #DC262640 0%, transparent 70%)",
          filter: "blur(65px)",
          transform: `translate(${Math.cos(frame * 0.03) * 18}px, ${Math.sin(frame * 0.035) * 22}px)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "16%",
          right: "8%",
          width: 440,
          height: 440,
          borderRadius: "50%",
          background: "radial-gradient(circle, #B91C1C35 0%, transparent 70%)",
          filter: "blur(75px)",
          transform: `translate(${Math.sin(frame * 0.028) * 16}px, ${Math.cos(frame * 0.03) * 20}px)`,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          perspective: 1150,
          transform: `scale(${cameraZoom})`,
        }}
      >
        <div
          style={{
            position: "relative",
            width: 790,
            opacity: cardOpacity,
            transform: `
              scale(${cardScale})
              translateY(${cardTranslateY}px)
              rotateX(${cardRotX}deg)
              rotateY(${cardRotY}deg)
              rotateZ(-1.8deg)
            `,
            transformStyle: "preserve-3d",
            filter: "url(#deckleEdge)",
          }}
        >
          <div
            style={{
              position: "relative",
              background: "#FBF9F5",
              borderRadius: 36,
              padding: "42px 48px 36px 48px",
              boxSizing: "border-box",
              boxShadow: `
                0 0 60px rgba(244, 63, 94, 0.46),
                0 0 120px rgba(225, 29, 72, 0.26),
                0 45px 85px rgba(0, 0, 0, 0.9),
                inset 0 1px 3px rgba(255, 255, 255, 0.95),
                inset 0 -1px 2px rgba(0, 0, 0, 0.05)
              `,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 36,
                filter: "url(#paperNoise)",
                opacity: 0.85,
                pointerEvents: "none",
              }}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: "#383838", letterSpacing: "-0.015em" }}>
                {SCENE_PARAMS.metricLabel}
              </span>

              <div
                style={{
                  opacity: badgeOpacity,
                  transform: `scale(${badgeScale})`,
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 14px",
                  borderRadius: 999,
                  background: SCENE_PARAMS.badgeBgColor,
                  border: `1.8px solid ${SCENE_PARAMS.badgeBorderColor}`,
                  boxShadow: "0 2px 8px rgba(225, 29, 72, 0.12)",
                }}
              >
                <span style={{ fontSize: 21, fontWeight: 800, color: SCENE_PARAMS.accentColor, letterSpacing: "-0.02em" }}>
                  {currentPercentage}%
                </span>
              </div>
            </div>

            <div
              style={{
                fontSize: 84,
                fontWeight: 900,
                lineHeight: 1.05,
                color: "#181D26",
                letterSpacing: "-0.05em",
                marginBottom: 24,
              }}
            >
              {SCENE_PARAMS.currencyPrefix}
              {formattedValue}
            </div>

            <div style={{ position: "relative", width: "100%", height: 210 }}>
              <svg viewBox="0 0 540 180" width="100%" height="100%" style={{ overflow: "visible" }}>
                {[105, 175, 245, 315, 385, 455].map((gx, i) => (
                  <line key={i} x1={gx} y1={28} x2={gx} y2={150} stroke="#DDE3EA" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.8" />
                ))}

                <path d="M 36 150 Q 270 149.2 504 150" fill="none" stroke="#334155" strokeWidth="2.0" strokeLinecap="round" />
                <path d={areaD} fill="url(#softAreaGrad)" clipPath="url(#chartProgressClip)" />
                <path d={polylineD} fill="none" stroke={SCENE_PARAMS.accentColor} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" clipPath="url(#chartProgressClip)" />

                {chartProgress > 0.01 && dotOpacity > 0 && (
                  <g transform={`translate(${currentTip.x}, ${currentTip.y})`} style={{ opacity: dotOpacity }}>
                    <circle r={10} fill={SCENE_PARAMS.accentColor} opacity={0.35 + Math.sin(frame * 0.28) * 0.2} />
                    <circle r={5.2} fill={SCENE_PARAMS.accentColor} />
                  </g>
                )}
              </svg>

              <div
                style={{
                  position: "absolute",
                  bottom: 8,
                  left: 20,
                  right: 20,
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 21,
                  fontWeight: 700,
                  color: "#334155",
                  letterSpacing: "-0.01em",
                }}
              >
                <span>{SCENE_PARAMS.startDate}</span>
                <span>{SCENE_PARAMS.endDate}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

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
