/** Inline HTML for Cloudflare Turnstile or hCaptcha inside WebView (Android / iOS). */

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function buildCaptchaHtml(siteKey: string, providerRaw: string): string {
  const key = escapeAttr(siteKey);
  const p = (providerRaw || "").toLowerCase();
  const bridge = `
    function send(token){
      try {
        var msg = JSON.stringify({ type: 'nh-captcha', token: token || '' });
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
        if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'nh-captcha', token: token || '' }, '*');
      } catch(e) {}
    }
    function sendEmpty(){ send(''); }
  `;

  if (p.includes("hcaptcha")) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<style>html,body{margin:0;background:transparent;min-height:84px;display:flex;justify-content:center;align-items:flex-start;}</style>
</head><body>
<div id="hc-root"></div>
<script>${bridge}
(function(){
  function start(){
    if (!window.hcaptcha || !window.hcaptcha.render) {
      setTimeout(start, 50);
      return;
    }
    try {
      hcaptcha.render(document.getElementById('hc-root'), {
        sitekey: '${key}',
        theme: 'dark',
        callback: function(t){ send(t); },
        'expired-callback': sendEmpty,
        'error-callback': sendEmpty
      });
    } catch(e) { sendEmpty(); }
  }
  var s = document.createElement('script');
  s.src = 'https://js.hcaptcha.com/1/api.js';
  s.async = true;
  s.onload = start;
  s.onerror = sendEmpty;
  document.head.appendChild(s);
})();
</script></body></html>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<style>html,body{margin:0;background:transparent;min-height:84px;display:flex;justify-content:center;align-items:flex-start;}</style>
</head><body>
<div id="cf-root"></div>
<script>${bridge}
(function(){
  function start(){
    if (!window.turnstile || !window.turnstile.render) {
      setTimeout(start, 50);
      return;
    }
    try {
      turnstile.render('#cf-root', {
        sitekey: '${key}',
        theme: 'dark',
        callback: function(t){ send(t); },
        'expired-callback': sendEmpty,
        'error-callback': sendEmpty
      });
    } catch(e) { sendEmpty(); }
  }
  var s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
  s.async = true;
  s.onload = start;
  s.onerror = sendEmpty;
  document.head.appendChild(s);
})();
</script></body></html>`;
}
