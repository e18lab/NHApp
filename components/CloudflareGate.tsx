import { useI18n } from "@/lib/i18n/I18nContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
type ForceCss = Record<string, string | string[]>;
type Props = {
  visible: boolean;
  galleryId?: number;
  onClose: () => void;
  prefillText?: string;
  onlyCommentFormCss?: boolean;
  customCss?: string | string[];
  forceHide?: string[];
  forceCss?: ForceCss;
  onPosted?: (json: any) => void;
  colors: {
    text: string;
    sub: string;
    card: string;
    border: string;
    accent: string;
    backdrop: string;
  };
};
const S = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  text: { fontSize: 13, marginBottom: 12 },
  row: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 14,
  },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  btnTxt: { fontWeight: "700" },
});
const NH = "https://nhentai.net";
const UA =
  "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36";
const COLLAPSED_H = 160;
const EXPANDED_H = 100;
function cssString(x?: string | string[]) {
  if (!x) return "";
  return Array.isArray(x) ? x.join("\n") : x;
}
export default function CloudflareGate({
  visible,
  galleryId,
  onClose,
  prefillText,
  onlyCommentFormCss = false,
  customCss,
  forceHide = [],
  forceCss = {},
  onPosted,
  colors,
}: Props) {
  const { t } = useI18n();
  const isElectron = Platform.OS === "web" && typeof window !== "undefined" && !!(window as any).electron?.isElectron;
  const [loading, setLoading] = useState(true);
  const [tries, setTries] = useState(0);
  const [showWeb, setShowWeb] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const webRef = useRef<WebView>(null);
  const handleElectronCloudflare = useCallback(async () => {
    if (!isElectron || !visible) return;
    try {
      setLoading(true);
      const electron = (window as any).electron;
      if (!electron || !electron.openCloudflareChallenge) {
        console.warn("[CloudflareGate] Electron IPC method not available");
        setLoading(false);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      try {
        const cookiesResult = await electron.getCookies('https://nhentai.net');
        const hasSession = cookiesResult.success && cookiesResult.cookies && cookiesResult.cookies.sessionid;
        if (!hasSession) {
          console.warn("[CloudflareGate] User not logged in, cannot post comments");
        }
      } catch (err) {
        console.warn("[CloudflareGate] Failed to check cookies:", err);
      }
      const url = galleryId 
        ? `https://nhentai.net/g/${galleryId}/#comment_form` 
        : 'https://nhentai.net/#comment_form';
      console.log(`[CloudflareGate] Opening Cloudflare challenge window for: ${url}`);
      const result = await electron.openCloudflareChallenge({
        url,
        galleryId,
        prefillText,
      });
      if (result.success) {
        if (result.cookies) {
          const { csrf, session, cf } = result.cookies;
          if (csrf) await AsyncStorage.setItem("nh.csrf", csrf);
          if (session) await AsyncStorage.setItem("nh.session", session);
          if (cf) await AsyncStorage.setItem("nh.cf_clearance", cf);
        }
        if (result.comment) {
          onPosted?.(result.comment);
        }
        onClose();
      } else {
        console.warn("[CloudflareGate] Cloudflare challenge failed:", result.error);
        setTries((t) => t + 1);
      }
    } catch (err: any) {
      console.error("[CloudflareGate] Error in Electron Cloudflare challenge:", err);
      setTries((t) => t + 1);
    } finally {
      setLoading(false);
    }
  }, [isElectron, visible, galleryId, prefillText, onPosted, onClose]);
  useEffect(() => {
    if (visible) {
      setShowWeb(false);
      setLoading(true);
      progress.setValue(0);
      setTries(0);
      if (isElectron) {
        handleElectronCloudflare();
      }
    }
  }, [visible, progress, isElectron, handleElectronCloudflare]);
  useEffect(() => {
    if (showWeb) {
      Animated.timing(progress, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [showWeb, progress]);
  const url = useMemo(
    () => (galleryId ? `${NH}/g/${galleryId}/` : `${NH}/`),
    [galleryId]
  );
  const prefillJSON = useMemo(
    () =>
      JSON.stringify(
        prefillText && prefillText.length >= 10 ? prefillText : "hellothere!!"
      ),
    [prefillText]
  );
  const baseCss = useMemo(() => {
    if (!onlyCommentFormCss) return "";
    return `
      body > *:not(#comment_form){display:none!important}
      #comment_form{max-width:720px;margin:20px auto!important;padding:12px}
      .btn{font-size:14px}
    `;
  }, [onlyCommentFormCss]);
  const mergedCss = useMemo(
    () => `
      html,body{background:#2b2b2b;color:#ddd}
      ${baseCss}
      ${cssString(customCss)}
    `,
    [baseCss, customCss]
  );
  const earlyInject = useMemo(
    () => `
      (function(){
        try{
          var FORCE_CSS = ${JSON.stringify({
            "html, body": [
              "margin:0",
              "padding:0",
              "overflow:hidden",
              "height:100vh",
              "width:100vw",
              "box-sizing:border-box",
            ],
            "#content, #comment-post-container, #comment_form, .row": [
              "margin:0",
              "padding:0",
              "height:100vh",
              "width:100vw",
              "max-width:100vw",
              "box-sizing:border-box",
              "background:#16181a",
            ],
            ...forceCss,
          })};
          function applyForceCss(){
            try{
              Object.keys(FORCE_CSS||{}).forEach(function(sel){
                var rules = FORCE_CSS[sel];
                var list = Array.isArray(rules) ? rules : String(rules||"").split(/;\\s*/);
                var decl = list.map(function(s){ return String(s||"").trim(); }).filter(Boolean);
                document.querySelectorAll(sel).forEach(function(el){
                  try{
                    decl.forEach(function(line){
                      var p = line.split(":");
                      if(p.length>=2){
                        var key = p[0].trim();
                        var val = p.slice(1).join(":").trim();
                        el.style.setProperty(key, val, "important");
                      }
                    });
                  }catch(_){}
                });
              });
            }catch(_){}
          }
          // meta viewport
          try{
            var vp = document.querySelector('meta[name="viewport"]');
            var content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
            if(!vp){
              vp = document.createElement("meta");
              vp.setAttribute("name","viewport");
              vp.setAttribute("content", content);
              (document.head||document.documentElement).appendChild(vp);
            }else{
              vp.setAttribute("content", content);
            }
          }catch(_){}
          // обычный CSS
          var css = ${JSON.stringify(mergedCss)};
          var style = document.createElement('style');
          style.id='rn-gate-css';
          style.type='text/css';
          style.appendChild(document.createTextNode(css));
          (document.head||document.documentElement).appendChild(style);
          // плавное появление
          var hide = document.createElement('style');
          hide.id='rn-gate-hide';
          hide.textContent='html{opacity:0!important}';
          (document.head||document.documentElement).appendChild(hide);
          var reveal=function(){
            try{ applyForceCss(); document.documentElement.style.opacity='1'; }catch(e){}
          };
          if(document.readyState==='loading'){
            document.addEventListener('DOMContentLoaded',reveal,{once:true});
          }else{
            reveal();
          }
          try{
            var mo = new MutationObserver(function(){ applyForceCss(); });
            mo.observe(document.documentElement,{subtree:true, childList:true, attributes:true});
          }catch(_){}
        }catch(e){}
      })(); true;
    `,
    [mergedCss, forceCss]
  );
  const injectedJS = `
    (function(){
      var PREFILL=${prefillJSON};
      var FORCE_HIDE=${JSON.stringify(forceHide || [])};
      var clickedOnce=false, clickedAfterToken=false;
      function post(o){ try{ window.ReactNativeWebView.postMessage(JSON.stringify(o)); }catch(_){ } }
      function absUrl(u){
        if(!u) return "";
        var s=String(u).trim();
        if(!s) return "";
        if(/^https?:\\/\\//i.test(s)) return s;
        if(s.startsWith("//")) return "https:"+s;
        if(s.startsWith("/avatars/")||s.startsWith("avatars/")){
          var p=s.startsWith("/")? s.slice(1):s;
          return "https://i.nhentai.net/"+p;
        }
        if(s.startsWith("/")) return "${NH}"+s;
        return s;
      }
      function getMeFromDom(){
        try{
          // пробуем правое меню
          var menu = document.querySelector('ul.menu.right') || document.querySelector('.menu.right');
          if(menu){
            var a = menu.querySelector('a[href*="/users/"]');
            if(a){
              var href = a.getAttribute('href')||"";
              var m = href.match(/\\/users\\/(\\d+)\\/([^\\/?#]+)/);
              var id = m? Number(m[1]) : undefined;
              var slug = m? decodeURIComponent(m[2]||"") : undefined;
              var unameEl = a.querySelector('.username');
              var username = unameEl? unameEl.textContent.trim() : (slug||"");
              var img = a.querySelector('img');
              var avatar_url = img? absUrl(img.getAttribute('data-src')||img.getAttribute('src')||"") : "";
              if(username){
                return {id:id, username: username, slug: slug, avatar_url: avatar_url};
              }
            }
          }
          // fallback: ищем в скриптах user: JSON.parse("...")
          var scripts = document.scripts||[];
          for(var i=0;i<i<scripts.length;i++){
            var t = scripts[i].textContent||"";
            var m = t.match(/user\\s*:\\s*JSON\\.parse\\((["'])(.*?)\\1\\)/i);
            if(m){
              try{
                var u = JSON.parse(m[2]);
                var id = u && Number(u.id)||undefined;
                var username = u && (u.username||"");
                var avatar_url = absUrl(u && (u.avatar_url||""));
                if(username){
                  return {id:id, username:String(username), slug:String(u.slug||""), avatar_url:avatar_url};
                }
              }catch(e){}
            }
          }
        }catch(e){}
        return null;
      }
      function enrichPostedJson(j){
        try{
          var me = getMeFromDom();
          if(!me) return j;
          var c = j && (j.comment || j.data && j.data.comment) || j;
          if(!c) return j;
          c.poster = c.poster || {};
          if(!c.poster.username) c.poster.username = me.username;
          if(!c.poster.id && me.id) c.poster.id = me.id;
          var haveAvatar = c.poster.avatar_url || c.poster.avatar || j.avatar_url || j.avatar;
          if(!haveAvatar && me.avatar_url){
            c.poster.avatar_url = absUrl(me.avatar_url);
          }
          if(j.comment){ j.comment = c; }
          else if(j.data && j.data.comment){ j.data.comment = c; }
          else { j = c; }
          return j;
        }catch(e){ return j; }
      }
      function sendMeTick(){
        try{
          var me = getMeFromDom();
          if(me){ post({type:'me', me: me}); }
        }catch(_){}
      }
      function getCookie(n){
        var m=document.cookie.match(new RegExp('(?:^|;\\\\s*)'+n+'=([^;]+)'));
        return m?decodeURIComponent(m[1]):'';
      }
      (function intercept(){
        try{
          var _open=XMLHttpRequest.prototype.open, _send=XMLHttpRequest.prototype.send;
          XMLHttpRequest.prototype.open=function(m,u){ this.__m=m; this.__u=u; return _open.apply(this,arguments); };
          XMLHttpRequest.prototype.send=function(){
            try{
              this.addEventListener('loadend',function(){
                try{
                  var u=String(this.__u||''), m=String(this.__m||'');
                  if(m.toUpperCase()==='POST' && /\\/api\\/gallery\\/\\d+\\/comments\\/submit/i.test(u)){
                    var status = Number(this.status||0);
                    var txt = this.responseText||'';
                    if (status>=200 && status<300) {
                      try { var j=JSON.parse(txt); j = enrichPostedJson(j); if(!j?.error){ post({type:'posted', json:j}); } } catch(_){}
                    } else if (status===403) {
                      post({type:'captcha_required'});
                    }
                  }
                }catch(_){}
              });
            }catch(_){}
            return _send.apply(this,arguments);
          };
        }catch(_){}
        try{
          var _fetch=window.fetch;
          window.fetch=function(input, init){
            var u = (typeof input==='string')? input : (input && input.url) ? input.url : '';
            var m = (init && init.method) ? String(init.method) : 'GET';
            var isTarget = /\\/api\\/gallery\\/\\d+\\/comments\\/submit/i.test(u) && m.toUpperCase()==='POST';
            return _fetch(input, init).then(function(res){
              if(isTarget){
                try{
                  var status = res.status;
                  var cp = res.clone();
                  cp.text().then(function(txt){
                    try{
                      if(status>=200 && status<300){
                        var j=JSON.parse(txt); j = enrichPostedJson(j);
                        if(!j?.error){ post({type:'posted', json:j}); }
                      }else if(status===403){
                        post({type:'captcha_required'});
                      }
                    }catch(_){}
                  });
                }catch(_){}
              }
              return res;
            });
          };
        }catch(_){}
      })();
      function findForm(){ return document.getElementById('comment_form'); }
      function findBtn(form){
        return form.querySelector('button[type="submit"],.btn.btn-primary[type="submit"]')
            || form.querySelector('button,input[type="submit"]');
      }
      function clickComment(){
        var form=findForm(); if(!form) return false;
        var btn=findBtn(form); if(!btn) return false;
        try{ btn.click(); return true; }catch(_){ return false; }
      }
      function prefill(){
        var form=findForm(); if(!form) return false;
        var ta=form.querySelector('#id_body'); if(!ta) return false;
        try{
          ta.value=PREFILL;
          ta.dispatchEvent(new Event('input',{bubbles:true}));
          ta.dispatchEvent(new Event('change',{bubbles:true}));
          return true;
        }catch(_){ return false; }
      }
      function focusTurnstile(){
        var ifr=document.querySelector('iframe[src*="challenges.cloudflare.com"]');
        if(ifr){
          try{
            ifr.style.width='100%'; ifr.style.maxWidth='100%'; ifr.style.height='120px';
            ifr.style.display='block'; ifr.scrollIntoView({block:'center',inline:'nearest'}); ifr.focus();
          }catch(_){}
          return true;
        }
        return false;
      }
      function applyForceHide(){
        try{
          ${JSON.stringify(forceHide || [])}.forEach(function(sel){
            document.querySelectorAll(sel).forEach(function(el){
              try{
                el.style.setProperty('display','none','important');
                el.style.setProperty('visibility','hidden','important');
                el.style.setProperty('opacity','0','important');
              }catch(_){}
            });
          });
        }catch(_){}
      }
      function pollToken(){
        try{
          if(window.turnstile && typeof window.turnstile.getResponse==='function'){
            var t=window.turnstile.getResponse();
            if(t && clickedOnce && !clickedAfterToken){
              clickedAfterToken=true;
              setTimeout(clickComment, 200);
            }
          }
        }catch(_){}
      }
      function tickCookies(){
        post({
          type:'cookies',
          cookie:document.cookie,
          cf:getCookie('cf_clearance'),
          csrf:getCookie('csrftoken'),
          session:getCookie('sessionid'),
          location:location.href
        });
      }
      function init(){
        applyForceHide();
        try{
          var mo=new MutationObserver(applyForceHide);
          mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true});
        }catch(_){}
        prefill();
        setTimeout(function(){ clickedOnce = clickComment(); }, 300);
        clearInterval(window.__fTick); window.__fTick=setInterval(focusTurnstile,600);
        clearInterval(window.__tTick); window.__tTick=setInterval(pollToken,500);
        clearInterval(window.__cTick); window.__cTick=setInterval(tickCookies,800);
        clearInterval(window.__mTick); window.__mTick=setInterval(sendMeTick,1200);
        sendMeTick();
      }
      if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',init); } else { init(); }
    })(); true;
  `;
  const handleMessage = useCallback(
    async (e: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(e.nativeEvent.data || "{}");
        if (msg?.type === "posted" && msg.json) {
          onPosted?.(msg.json);
          return;
        }
        if (msg?.type === "captcha_required") {
          if (!showWeb) setShowWeb(true);
          return;
        }
        if (msg?.type === "cookies") {
          const { csrf, session, cf } = msg;
          if (csrf) await AsyncStorage.setItem("nh.csrf", csrf);
          if (session) await AsyncStorage.setItem("nh.session", session);
          if (cf) await AsyncStorage.setItem("nh.cf_clearance", cf);
          return;
        }
        if (msg?.type === "me" && msg.me) {
          try {
            await AsyncStorage.setItem("nh.me", JSON.stringify(msg.me));
          } catch {}
          return;
        }
      } catch {}
    },
    [onPosted, showWeb]
  );
  const reload = () => {
    setTries((t) => t + 1);
    if (isElectron) {
      handleElectronCloudflare();
    } else {
      webRef.current?.reload();
    }
  };
  const allowNav = useCallback((req: any): boolean => {
    const u: string = String(req?.url || "");
    if (
      u.startsWith("about:blank") ||
      u.startsWith("data:") ||
      u.startsWith("blob:")
    )
      return true;
    const host = u.replace(/^[a-z]+:\/\//, '');
    return /(?:^|\.)nhentai\.net$|^challenges\.cloudflare\.com$/.test(host);
  }, []);
  const wrapHeight = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [COLLAPSED_H, EXPANDED_H],
  });
  const contentOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const contentScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.985, 1],
  });
  if (isElectron) {
    return null;
  }
  return (
    <Modal
      visible={visible}
      statusBarTranslucent
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[S.backdrop, { backgroundColor: colors.backdrop }]}>
        <View
          style={[
            S.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[S.title, { color: colors.text }]}>
            {t("cloudflare.title")}
          </Text>
          <Text style={[S.text, { color: colors.sub }]}>
            {showWeb
              ? t("cloudflare.caption.tap")
              : t("cloudflare.caption.preparing")}
          </Text>
          <Animated.View
            style={{ height: wrapHeight, borderRadius: 10, overflow: "hidden" }}
          >
            {!showWeb && (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ActivityIndicator />
                <Text style={{ marginTop: 8, color: colors.sub, fontSize: 12 }}>
                  {t("cloudflare.requesting")}
                </Text>
              </View>
            )}
            {!isElectron ? (
              <Animated.View
                pointerEvents={showWeb ? "auto" : "none"}
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: contentOpacity,
                  transform: [{ scale: contentScale }],
                }}
              >
                <WebView
                  ref={webRef}
                  source={{ uri: url + "#comment_form" }}
                  style={{ flex: 1, backgroundColor: "transparent" }}
                  onLoadStart={() => setLoading(true)}
                  onLoadEnd={() => setLoading(false)}
                  scrollEnabled={false}
                  bounces={false}
                  overScrollMode="never"
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  sharedCookiesEnabled
                  thirdPartyCookiesEnabled
                  originWhitelist={["*"]}
                  javaScriptEnabled
                  domStorageEnabled
                  userAgent={UA}
                  injectedJavaScriptBeforeContentLoaded={earlyInject}
                  injectedJavaScript={injectedJS}
                  onMessage={handleMessage}
                  onShouldStartLoadWithRequest={allowNav}
                />
                {loading && (
                  <View
                    style={{
                      position: "absolute",
                      inset: 0,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <ActivityIndicator />
                  </View>
                )}
              </Animated.View>
            ) : (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {loading ? (
                  <>
                    <ActivityIndicator />
                    <Text style={{ marginTop: 8, color: colors.sub, fontSize: 12 }}>
                      {t("cloudflare.requesting")}
                    </Text>
                  </>
                ) : (
                  <Text style={{ color: colors.sub, fontSize: 12, textAlign: "center", padding: 16 }}>
                    {t("cloudflare.caption.tap")}
                  </Text>
                )}
              </View>
            )}
          </Animated.View>
          <View style={S.row}>
            <Pressable
              onPress={reload}
              style={[S.btn, { backgroundColor: colors.border }]}
            >
              <Text style={[S.btnTxt, { color: colors.text }]}>
                {t("cloudflare.actions.reload")}
              </Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={[S.btn, { backgroundColor: colors.accent }]}
            >
              <Text style={[S.btnTxt, { color: "#fff" }]}>
                {t("cloudflare.actions.close")}
              </Text>
            </Pressable>
          </View>
          <Text style={[S.text, { color: colors.sub, marginTop: 8 }]}>
            {t("cloudflare.stats.attempts", { n: tries })}
          </Text>
        </View>
      </View>
    </Modal>
  );
}
