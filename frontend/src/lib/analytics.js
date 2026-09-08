import { api } from "@/lib/api";

const GA_ID = process.env.REACT_APP_GA_MEASUREMENT_ID;
const SAFE_KEYS = ["service_slug", "doctor_slug", "step", "source", "path"];

export function initAnalytics() {
  if (!GA_ID || window.__gaLoaded) return;
  window.__gaLoaded = true;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { anonymize_ip: true });
}

export function track(name, params = {}) {
  const safe = Object.fromEntries(Object.entries(params).filter(([k]) => SAFE_KEYS.includes(k)));
  if (window.gtag) window.gtag("event", name, safe);
  api.post("/public/events", { name, params: safe }).catch(() => {});
}
