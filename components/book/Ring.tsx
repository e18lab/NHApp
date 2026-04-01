import { useTheme } from "@/lib/ThemeContext";
import React from "react";
import Svg, { Circle as SvgCircle } from "react-native-svg";
export const Ring = ({
  progress,
  size = 22,
  stroke = 3,
}: { progress: number; size?: number; stroke?: number }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - progress);
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <SvgCircle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={colors.accent}
        strokeOpacity={0.3}
        strokeWidth={stroke}
        fill="none"
      />
      <SvgCircle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={colors.accent}
        strokeWidth={stroke}
        strokeDasharray={`${c}`}
        strokeDashoffset={off}
        strokeLinecap="round"
        fill="none"
        rotation={-90}
        origin={`${size / 2},${size / 2}`}
      />
    </Svg>
  );
};
export default Ring;
