/* ============================================================
   TRAÇAGE (§18) — la source suit le prospect de bout en bout.
   Chaque QR imprimé porte son paramètre : essai.boxingcenter.fr/?src=flyer
   La valeur est mémorisée pour la session, même si l'URL est nettoyée.
   Le branchement réel (GA4 / Meta / webhook) se pose sur `track()`
   et nulle part ailleurs.
   ============================================================ */

import { SOURCES } from "./data.js";

const KEY = "bc-essai-src";

function readUtm() {
  const p = new URLSearchParams(location.search);
  return {
    src: (p.get("src") || p.get("utm_source") || "").toLowerCase().trim(),
    medium: (p.get("utm_medium") || "").toLowerCase().trim(),
    campaign: (p.get("utm_campaign") || p.get("c") || "").toLowerCase().trim(),
  };
}

function isFlyerUtm(u) {
  if (u.src === "flyer" || u.src === "affiche") return true;
  if (u.src === "qr" && (u.medium === "poster" || u.campaign === "rentree_2026" || u.campaign === "rentree-2026")) return true;
  return false;
}

function readSource() {
  const u = readUtm();
  const raw = isFlyerUtm(u) ? "flyer" : u.src;
  if (raw) {
    try { sessionStorage.setItem(KEY, raw); } catch { /* mode privé */ }
    return raw;
  }
  try { return sessionStorage.getItem(KEY) || "direct"; } catch { return "direct"; }
}

export const SOURCE = readSource();
/* Une source inconnue est affichée telle quelle en mode maquette, mais
   nettoyée : on ne recopie pas n'importe quoi depuis l'URL, même échappé. */
export const SOURCE_LABEL =
  SOURCES[SOURCE] ||
  (SOURCE === "direct"
    ? "Accès direct"
    : SOURCE.replace(/[^a-z0-9 _-]/gi, "").slice(0, 24) || "Source inconnue");

/** Numéro de laissez-passer, dérivé de la source : le flyer scanné a son numéro à l'écran. */
export const PASS_NO = (() => {
  const p = new URLSearchParams(location.search);
  const camp = (p.get("c") || p.get("utm_campaign") || "").replace(/[^a-z0-9]/gi, "").slice(0, 5);
  /* Le préfixe est montré au visiteur : il ne doit contenir que des lettres.
     Sans filtre, un ?src= fantaisiste produisait « N° <IM-7643 » ou
     « N° " O-4205 » — aucune injection possible, l'échappement tient, mais
     du caractère parasite dans un identifiant qu'on affiche. */
  const propre = (SOURCE === "direct" ? "web" : SOURCE).replace(/[^a-z]/gi, "");
  const base = (propre || "web").slice(0, 3).toUpperCase();
  const seed = camp || SOURCE;
  const n = (Math.abs([...seed].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7)) % 9000) + 1000;
  return `${base}-${n}`;
})();

function persistVisit(event) {
  try {
    if (sessionStorage.getItem("bc-essai-pv")) return;
    sessionStorage.setItem("bc-essai-pv", "1");
  } catch { /* mode privé : on envoie quand même */ }
  const u = readUtm();
  const body = JSON.stringify({
    event,
    src: SOURCE,
    utm_source: u.src,
    medium: u.medium,
    campaign: u.campaign,
    path: location.pathname + location.search,
  });
  try {
    navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
  } catch {
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }
}

export function track(event, data = {}) {
  const payload = { event: "bc_" + event, source: SOURCE, ...data };
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
  if (typeof window.gtag === "function") {
    window.gtag("event", event, { source: SOURCE, ...data });
  }
  if (typeof window.fbq === "function") {
    window.fbq("trackCustom", event, { source: SOURCE, ...data });
  }
  if (event === "page_vue") persistVisit(event);
  if (import.meta.env && import.meta.env.DEV) console.info("[suivi]", payload);
}

function bootPixels() {
  const ga = import.meta.env && import.meta.env.VITE_GA4_MEASUREMENT_ID;
  const pixel = import.meta.env && import.meta.env.VITE_META_PIXEL_ID;
  if (ga && !document.getElementById("bc-ga4")) {
    const s = document.createElement("script");
    s.id = "bc-ga4";
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga)}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", ga, { anonymize_ip: true });
  }
  if (pixel && !document.getElementById("bc-meta-pixel")) {
    const s = document.createElement("script");
    s.id = "bc-meta-pixel";
    s.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${String(pixel).replace(/[^0-9]/g, "")}');fbq('track','PageView');`;
    document.head.appendChild(s);
  }
}

bootPixels();
