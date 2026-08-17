import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]) }));

import { deliverSignedWebhook } from "./handoffWebhook";

afterEach(() => vi.unstubAllGlobals());

describe("deliverSignedWebhook", () => {
  it("publica un expediente con identificador, evento y firma verificable", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ reference: "audit-42" }), { status: 201, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deliverSignedWebhook({ webhookUrl: "https://saas.example.com/webhooks/nexo", secret: "prueba-secreta", event: "audit.dossier.ready", deliveryId: "handoff_abc", payload: { dossier: { version: "2.0" } } })).resolves.toMatchObject({ reference: "audit-42" });
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = request.headers as Record<string, string>;
    expect(request.method).toBe("POST");
    expect(headers["x-nexo-event"]).toBe("audit.dossier.ready");
    expect(headers["x-nexo-delivery-id"]).toBe("handoff_abc");
    expect(headers["x-nexo-signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
  });
});
