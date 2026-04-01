export const NHENTAI_ORIGIN = "https://nhentai.net" as const;

/**
 * URL, который session.protocol.handle обслуживает нашим HTML (buildCaptchaHtml).
 * Для Turnstile origin = nhentai.net → работает как baseUrl на мобильном WebView.
 */
export const NH_CAPTCHA_EMBED_URL = `${NHENTAI_ORIGIN}/__captcha__` as const;
export const NH_CAPTCHA_PARTITION = "persist:nh-captcha" as const;
