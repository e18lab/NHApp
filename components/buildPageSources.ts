import { buildImageFallbacks } from "./buildImageFallbacks";
export const buildPageSources = (url: string): string[] => {
  const hostMatch = url.match(/^https:\/\/i\d\.nhentai\.net\/(.+)$/);
  if (!hostMatch) return buildImageFallbacks(url);
  const path = hostMatch[1];                          
  const hosts = ["i1", "i2", "i3", "i4"];
  const exts  = buildImageFallbacks(url).map((u) => u.split(".").pop()!);
  const uniq = new Set<string>();
  hosts.forEach((h) =>
    exts.forEach((ext) => {
      const full = `https://${h}.nhentai.net/${path.replace(/\.(\w+)(\.webp)?$/, `.${ext}`)}`;
      uniq.add(full);
    }),
  );
  return [...uniq];
};
