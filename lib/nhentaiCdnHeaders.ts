/** Without this, i./t. nhentai CDN often returns 403 for app / native image requests. */
export const NHENTAI_CDN_HEADERS: Record<string, string> = {
  Referer: "https://nhentai.net/",
};

export function isNhentaiHostedUrl(uri: string): boolean {
  return typeof uri === "string" && /nhentai\.net/i.test(uri);
}
