import React, { useState } from "react";
import { Image, ImageProps } from "react-native";
interface Props extends Omit<ImageProps, "source"> {
  sources: string[];
}
export default function SmartImage({ sources, ...rest }: Props) {
  const [idx, setIdx] = useState(0);
  if (sources.length === 0) return null;
  return (
    <Image
      {...rest}
      source={{ uri: sources[idx] }}
      onError={() => {
        if (idx + 1 < sources.length) setIdx(idx + 1);
      }}
    />
  );
}
