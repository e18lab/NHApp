import { NHENTAI_CDN_HEADERS, isNhentaiHostedUrl } from "@/lib/nhentaiCdnHeaders";
import { Image as ExpoImage, ImageProps } from "expo-image";
import { Platform } from "react-native";
import React, { useState, useEffect, useCallback } from "react";

const isElectron = Platform.OS === "web" && typeof window !== "undefined" && !!(window as any).electron?.isElectron;
interface ExpoImageWithRetryProps extends Omit<ImageProps, "source"> {
  source: string | string[] | { uri: string } | { uri: string }[];
  maxRetries?: number;
  retryDelay?: number;
}
export default function ExpoImageWithRetry({
  source,
  maxRetries = 3,
  retryDelay = 1000,
  ...props
}: ExpoImageWithRetryProps) {
  const normalizeSource = useCallback((src: typeof source): string[] => {
    if (typeof src === "string") return [src];
    if (Array.isArray(src)) {
      return src.map((s) => (typeof s === "string" ? s : s.uri));
    }
    if (src && typeof src === "object" && "uri" in src) {
      return [src.uri];
    }
    return [];
  }, []);
  const uris = normalizeSource(source);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [key, setKey] = useState(0); 
  useEffect(() => {
    setCurrentIndex(0);
    setRetryCount(0);
    setKey((k) => k + 1);
  }, [JSON.stringify(uris)]);
  const currentUri = uris[currentIndex];
  if (!currentUri) return null;
  let finalResponsivePolicy = props.responsivePolicy;
  if (isElectron) {
    if (!finalResponsivePolicy || finalResponsivePolicy === "static") {
      finalResponsivePolicy = "initial";
    }
  }
  const handleError = useCallback(() => {
    if (currentIndex + 1 < uris.length) {
      setCurrentIndex((i) => i + 1);
      setRetryCount(0);
      setKey((k) => k + 1); 
      return;
    }
    if (retryCount < maxRetries) {
      setTimeout(() => {
        setRetryCount((r) => r + 1);
        setKey((k) => k + 1); 
        setCurrentIndex(0); 
      }, retryDelay * (retryCount + 1)); 
    }
  }, [currentIndex, uris.length, retryCount, maxRetries, retryDelay]);
  return (
    <ExpoImage
      {...props}
      key={`${currentUri}-${key}-${retryCount}`} 
      source={
        isNhentaiHostedUrl(currentUri)
          ? { uri: currentUri, headers: NHENTAI_CDN_HEADERS }
          : { uri: currentUri }
      }
      responsivePolicy={finalResponsivePolicy}
      onError={handleError}
    />
  );
}
