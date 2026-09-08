import { useEffect } from "react";

const SITE_NAME = "Kaushalya Advanced Physio Therapy and Paralysis Center";

function upsertMeta(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement(attrs.tag || "meta");
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => k !== "tag" && el.setAttribute(k, v));
}

export function useSeo({ title, description, path = "", jsonLd, noindex = false }) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
    document.title = fullTitle;
    const url = `${window.location.origin}${path}`;
    upsertMeta('meta[name="description"]', { name: "description", content: description || "" });
    upsertMeta('meta[name="robots"]', { name: "robots", content: noindex ? "noindex, nofollow" : "index, follow" });
    upsertMeta('link[rel="canonical"]', { tag: "link", rel: "canonical", href: url });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: fullTitle });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: description || "" });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: url });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: SITE_NAME });
    let script = document.getElementById("jsonld");
    if (jsonLd) {
      if (!script) {
        script = document.createElement("script");
        script.id = "jsonld";
        script.type = "application/ld+json";
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    } else if (script) {
      script.remove();
    }
  }, [title, description, path, jsonLd, noindex]);
}
