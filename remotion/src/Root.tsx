import React from "react";
import { Composition } from "remotion";
import { MainVideo, MainProps } from "./MainVideo";
import { analyzeScript, totalFrames, DIMS } from "./scenes";

const SAMPLE = `AI tools se paisa kaise kamaye?
Pehla secret ye hai ki consistency rakho.
Doosra tool bahut powerful hai.
Abhi start karo aur channel subscribe karo.`;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MainVideo"
      component={MainVideo}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ script: SAMPLE, style: "viral-hook", aspect: "9:16" } as MainProps}
      calculateMetadata={({ props }) => {
        const fps = 30;
        const scenes = analyzeScript(props.script, fps);
        const [w, h] = DIMS[props.aspect] || DIMS["9:16"];
        return { durationInFrames: totalFrames(scenes), fps, width: w, height: h };
      }}
    />
  );
};
