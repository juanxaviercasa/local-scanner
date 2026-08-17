import { ENV } from "./_core/env";
import { lookup } from "node:dns/promises";

export type WebsiteAnalysis = {
  strategy: "mobile" | "desktop";
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  signals: Record<string, boolean | number | string | null>;
  quality: "excellent" | "good" | "average" | "weak" | "very_weak" | "broken";
  summary: string;
};

type PageSpeedResponse = {
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null }>;
    audits?: Record<string, { score?: number | null; displayValue?: string }>;
  };
  error?: { message?: string };
};

function toScore(value?: number | null) {
  return typeof value === "number" ? Math.max(0, Math.min(100, Math.round(value * 100))) : null;
}

function qualityForPerformance(score: number | null): WebsiteAnalysis["quality"] {
  if (score === null || score < 20) return "broken";
  if (score < 40) return "very_weak";
  if (score < 60) return "weak";
  if (score < 80) return "average";
  if (score < 92) return "good";
  return "excellent";
}

export function isPageSpeedConfigured() {
  return Boolean(ENV.paidConnectorsEnabled && ENV.googlePageSpeedApiKey);
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:" )) return true;
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
}

async function assertPublicUrl(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Solo se pueden analizar sitios web públicos con HTTP o HTTPS.");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) throw new Error("No se permiten direcciones locales o privadas.");
  const addresses = await lookup(hostname, { all: true, verbatim: true }).catch(() => []);
  if (!addresses.length || addresses.some(item => isPrivateAddress(item.address))) throw new Error("El sitio debe resolver a una dirección pública verificable.");
}

async function analyzeBasicPublicWebsite(url: URL, strategy: "mobile" | "desktop"): Promise<WebsiteAnalysis> {
  await assertPublicUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "manual", headers: { "User-Agent": "NexoOpsWebsiteCheck/1.0 (+public-site-analysis)" } });
    const contentType = response.headers.get("content-type") || "";
    const html = contentType.includes("text/html") ? (await response.text()).slice(0, 200_000) : "";
    const title = /<title[^>]*>([\s\S]*?)<\/title>/i.test(html);
    const viewport = /<meta[^>]+name=["']viewport["'][^>]*>/i.test(html);
    const description = /<meta[^>]+name=["']description["'][^>]*>/i.test(html);
    const https = url.protocol === "https:";
    const reachable = response.status >= 200 && response.status < 400;
    const signalCount = [title, viewport, description, https, reachable].filter(Boolean).length;
    return {
      strategy, performanceScore: null, accessibilityScore: null, bestPracticesScore: null, seoScore: null,
      signals: { analysis_provider: "basic_public", http_status: response.status, uses_https: https, reachable, has_title: title, has_viewport: viewport, has_meta_description: description, redirect_detected: response.status >= 300 && response.status < 400 },
      quality: reachable ? (signalCount >= 4 ? "average" : "weak") : "broken",
      summary: reachable ? `Comprobación pública básica: HTTP ${response.status}, ${title ? "con" : "sin"} título, ${viewport ? "con" : "sin"} viewport y ${description ? "con" : "sin"} descripción. Activa PageSpeed opcionalmente para métricas detalladas.` : `El sitio respondió con HTTP ${response.status}; no se realizaron métricas detalladas.`,
    };
  } finally { clearTimeout(timer); }
}

export async function analyzePublicWebsite(url: string, strategy: "mobile" | "desktop" = "mobile"): Promise<WebsiteAnalysis> {
  const parsed = new URL(url);
  if (!isPageSpeedConfigured()) return analyzeBasicPublicWebsite(parsed, strategy);
  await assertPublicUrl(parsed);
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", parsed.toString());
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.set("key", ENV.googlePageSpeedApiKey);
  ["PERFORMANCE", "ACCESSIBILITY", "BEST_PRACTICES", "SEO"].forEach(category => endpoint.searchParams.append("category", category));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    const payload = await response.json().catch(() => ({})) as PageSpeedResponse;
    if (!response.ok || payload.error) throw new Error(payload.error?.message || `PageSpeed Insights respondió con estado ${response.status}.`);
    const categories = payload.lighthouseResult?.categories ?? {};
    const audits = payload.lighthouseResult?.audits ?? {};
    const performanceScore = toScore(categories.performance?.score);
    const accessibilityScore = toScore(categories.accessibility?.score);
    const bestPracticesScore = toScore(categories["best-practices"]?.score);
    const seoScore = toScore(categories.seo?.score);
    const signals = {
      uses_https: audits["is-on-https"]?.score === 1,
      has_viewport: audits.viewport?.score === 1,
      has_title: audits["document-title"]?.score === 1,
      has_meta_description: audits["meta-description"]?.score === 1,
      tap_targets_usable: audits["tap-targets"]?.score === 1,
      first_contentful_paint: audits["first-contentful-paint"]?.displayValue ?? null,
      largest_contentful_paint: audits["largest-contentful-paint"]?.displayValue ?? null,
    };
    const quality = qualityForPerformance(performanceScore);
    const scoreList = [["rendimiento", performanceScore], ["accesibilidad", accessibilityScore], ["buenas prácticas", bestPracticesScore], ["SEO", seoScore]].filter((item): item is [string, number] => typeof item[1] === "number");
    return {
      strategy,
      performanceScore,
      accessibilityScore,
      bestPracticesScore,
      seoScore,
      signals,
      quality,
      summary: `Análisis ${strategy === "mobile" ? "móvil" : "de escritorio"}: ${scoreList.map(([label, score]) => `${label} ${score}/100`).join(", ") || "sin métricas disponibles"}.`,
    };
  } finally {
    clearTimeout(timer);
  }
}
