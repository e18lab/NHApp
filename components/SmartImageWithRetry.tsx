import { NHENTAI_CDN_HEADERS, isNhentaiHostedUrl } from "@/lib/nhentaiCdnHeaders";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Image, ImageProps, ActivityIndicator, View, StyleSheet } from "react-native";
interface Props extends Omit<ImageProps, "source"> {
  sources: string[];
  maxRetries?: number;
  retryDelay?: number;
  showLoader?: boolean;
}
export default function SmartImageWithRetry({ 
  sources, 
  maxRetries = 3,
  retryDelay = 1000,
  showLoader = true,
  style,
  ...rest 
}: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef({ currentIdx: 0, retryCount: 0 });
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);
  useEffect(() => {
    setCurrentIdx(0);
    setRetryCount(0);
    setLoading(true);
    setError(false);
    stateRef.current = { currentIdx: 0, retryCount: 0 };
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, [JSON.stringify(sources)]);
  useEffect(() => {
    stateRef.current = { currentIdx, retryCount };
  }, [currentIdx, retryCount]);
  const handleError = useCallback(() => {
    if (!mountedRef.current) return;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    const { currentIdx: idx, retryCount: retry } = stateRef.current;
    if (idx + 1 < sources.length) {
      setCurrentIdx(idx + 1);
      setRetryCount(0);
      setLoading(true);
      setError(false);
      return;
    }
    if (retry < maxRetries) {
      setLoading(true);
      setError(false);
      retryTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setRetryCount((prev) => prev + 1);
          setCurrentIdx(0);
        }
        retryTimeoutRef.current = null;
      }, retryDelay * (retry + 1));
      return;
    }
    setLoading(false);
    setError(true);
  }, [sources.length, maxRetries, retryDelay]);
  const handleLoad = useCallback(() => {
    if (!mountedRef.current) return;
    setLoading(false);
    setError(false);
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);
  if (sources.length === 0) return null;
  const currentSource = sources[currentIdx];
  if (!currentSource) return null;
  return (
    <View style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Image
        {...rest}
        key={`${currentSource}-${retryCount}`}
        source={
          isNhentaiHostedUrl(currentSource)
            ? { uri: currentSource, headers: NHENTAI_CDN_HEADERS }
            : { uri: currentSource }
        }
        style={[style, { opacity: loading || error ? 0 : 1 }]}
        onError={handleError}
        onLoad={handleLoad}
      />
      {loading && showLoader && (
        <View style={[StyleSheet.absoluteFill, styles.loaderContainer]}>
          <ActivityIndicator size="small" color="#888" />
        </View>
      )}
      {error && !loading && showLoader && (
        <View style={[StyleSheet.absoluteFill, styles.errorContainer]}>
          <ActivityIndicator size="small" color="#ff6b6b" />
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});
