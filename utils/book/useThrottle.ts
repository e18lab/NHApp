import { useCallback, useRef } from "react";
export const useThrottle = <T extends any[]>(
  fn: (...args: T) => void,
  ms: number
) => {
  const last = useRef(0);
  return useCallback(
    (...args: T) => {
      const now = Date.now();
      if (now - last.current >= ms) {
        last.current = now;
        fn(...args);
      }
    },
    [fn, ms]
  );
};
