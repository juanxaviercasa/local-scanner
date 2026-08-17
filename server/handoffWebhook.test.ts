import { describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async () => [{ address: "192.168.1.5", family: 4 }]) }));

import { validateWebhookUrl } from "./handoffWebhook";

describe("validateWebhookUrl", () => {
  it("exige HTTPS y rechaza destinos privados", async () => {
    await expect(validateWebhookUrl("http://saas.example.com/hook")).rejects.toThrow("HTTPS");
    await expect(validateWebhookUrl("https://saas.example.com/hook")).rejects.toThrow("dirección pública");
    await expect(validateWebhookUrl("https://127.0.0.1/hook")).rejects.toThrow("direcciones locales");
  });
});
