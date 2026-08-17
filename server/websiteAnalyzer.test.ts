import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/env", () => ({ ENV: { googlePageSpeedApiKey: "", paidConnectorsEnabled: false } }));
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

import { lookup } from "node:dns/promises";
import { analyzePublicWebsite } from "./websiteAnalyzer";

const lookupMock = vi.mocked(lookup);

describe("análisis público básico de sitio web", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  it("obtiene solo señales HTML públicas cuando PageSpeed no está configurado", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      '<html><head><title>Negocio local</title><meta name="viewport" content="width=device-width"><meta name="description" content="Servicios locales"></head></html>',
      { status: 200, headers: { "content-type": "text/html" } },
    )));

    const result = await analyzePublicWebsite("https://example.com", "mobile");

    expect(result.signals).toMatchObject({ analysis_provider: "basic_public", reachable: true, uses_https: true, has_title: true, has_viewport: true, has_meta_description: true });
    expect(result.performanceScore).toBeNull();
    expect(result.quality).toBe("average");
  });

  it("bloquea direcciones locales antes de solicitar contenido", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(analyzePublicWebsite("http://localhost:3000")).rejects.toThrow("direcciones locales o privadas");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bloquea dominios que resuelven a redes privadas", async () => {
    lookupMock.mockResolvedValue([{ address: "192.168.1.10", family: 4 }]);
    vi.stubGlobal("fetch", vi.fn());

    await expect(analyzePublicWebsite("https://intranet.example")).rejects.toThrow("dirección pública verificable");
  });
});
