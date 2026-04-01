import { Image as ExpoImage, ImageProps, type ImageSource } from "expo-image";
import { NHENTAI_CDN_HEADERS, isNhentaiHostedUrl } from "@/lib/nhentaiCdnHeaders";
import { Platform } from "react-native";
import React from "react";

const isElectron = Platform.OS === "web" && typeof window !== "undefined" && !!(window as any).electron?.isElectron;

function withNhentaiHeaders(uri: string): ImageSource {
  return { uri, headers: NHENTAI_CDN_HEADERS };
}

/** Attach Referer for nhentai CDN when missing (required on many native loads). */
export function augmentExpoImageSource(
  source: ImageProps["source"]
): ImageProps["source"] {
  if (source == null || typeof source === "number") return source;
  if (typeof source === "string") {
    return isNhentaiHostedUrl(source) ? withNhentaiHeaders(source) : source;
  }
  if (Array.isArray(source)) {
    return source.map((item) => {
      if (typeof item === "string") {
        return isNhentaiHostedUrl(item) ? withNhentaiHeaders(item) : item;
      }
      if (item && typeof item === "object" && "uri" in item) {
        const s = item as ImageSource;
        if (
          typeof s.uri === "string" &&
          isNhentaiHostedUrl(s.uri) &&
          !s.headers
        ) {
          return { ...s, headers: NHENTAI_CDN_HEADERS };
        }
      }
      return item;
    }) as ImageProps["source"];
  }
  if (typeof source === "object" && source !== null && "uri" in source) {
    const s = source as ImageSource;
    if (
      typeof s.uri === "string" &&
      isNhentaiHostedUrl(s.uri) &&
      !s.headers
    ) {
      return { ...s, headers: NHENTAI_CDN_HEADERS };
    }
  }
  return source;
}

export default function ExpoImageCompat(props: ImageProps) {
  let finalResponsivePolicy = props.responsivePolicy;
  if (isElectron) {
    if (!finalResponsivePolicy || finalResponsivePolicy === "static") {
      finalResponsivePolicy = "initial";
    }
  }
  const source = augmentExpoImageSource(props.source);
  return (
    <ExpoImage
      {...props}
      source={source}
      responsivePolicy={finalResponsivePolicy}
    />
  );
}