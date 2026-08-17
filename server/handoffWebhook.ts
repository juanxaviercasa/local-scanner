import { createHmac } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  return parts.length === 4 && (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0
  );
}

function isPrivateIp(address: string) {
  if (isIP(address) === 4) return isPrivateIpv4(address);
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:") || normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.");
}

export async function validateWebhookUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("La URL del webhook no tiene un formato válido.");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:") throw new Error("El webhook debe usar HTTPS.");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || isIP(hostname)) {
    throw new Error("El webhook debe apuntar a un dominio público HTTPS; no se admiten direcciones locales ni IP directas.");
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(address => isPrivateIp(address.address))) {
    throw new Error("El dominio del webhook no resuelve a una dirección pública permitida.");
  }
  return parsed.toString();
}

export async function deliverSignedWebhook(input: { webhookUrl: string; secret: string; event: string; deliveryId: string; payload: unknown }) {
  const webhookUrl = await validateWebhookUrl(input.webhookUrl);
  const timestamp = new Date().toISOString();
  const body = JSON.stringify(input.payload);
  const signature = createHmac("sha256", input.secret).update(`${timestamp}.${body}`).digest("hex");
  const response = await fetch(webhookUrl, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "content-type": "application/json",
      "user-agent": "Nexo-Local-Opportunity-Scanner/1.0",
      "x-nexo-event": input.event,
      "x-nexo-delivery-id": input.deliveryId,
      "x-nexo-timestamp": timestamp,
      "x-nexo-signature": `sha256=${signature}`,
    },
    body,
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`El SaaS respondió ${response.status}: ${responseText.slice(0, 400) || "sin detalle"}`);
  let reference: string | null = null;
  try {
    const parsed = JSON.parse(responseText) as { reference?: unknown; id?: unknown };
    reference = typeof parsed.reference === "string" ? parsed.reference : typeof parsed.id === "string" ? parsed.id : null;
  } catch {
    // El receptor puede responder 2xx sin cuerpo JSON; la entrega sigue siendo válida.
  }
  return { webhookUrl, reference };
}
