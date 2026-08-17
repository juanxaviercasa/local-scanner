import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Dossier = Record<string, any>;

const slate = rgb(0.08, 0.13, 0.22);
const violet = rgb(0.31, 0.18, 0.7);
const muted = rgb(0.33, 0.39, 0.48);

function wrap(text: string, max = 84) {
  const words = String(text ?? "").replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) { lines.push(current); current = word; } else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

/** Genera un expediente local y descargable; no envía información a terceros. */
export async function buildAuditDossierPdf(dossier: Dossier) {
  const document = await PDFDocument.create();
  document.setTitle(`Expediente de auditoría — ${dossier.business?.name ?? "Nexo Local"}`);
  document.setAuthor("Nexo Local Opportunity Scanner");
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page = document.addPage([595.28, 841.89]);
  let y = 790;
  const addPage = () => { page = document.addPage([595.28, 841.89]); y = 790; };
  const line = (text: string, size = 10, color = slate, font = regular) => {
    const rows = wrap(text, size >= 16 ? 48 : 88);
    for (const row of rows) { if (y < 56) addPage(); page.drawText(row, { x: 48, y, size, font, color }); y -= size + 5; }
  };
  const heading = (text: string) => { if (y < 88) addPage(); y -= 8; line(text, 15, violet, bold); y -= 4; };
  const bullets = (items: string[] | undefined) => (items ?? []).forEach(item => line(`• ${item}`, 10, slate, regular));

  line("NEXO LOCAL · EXPEDIENTE DE AUDITORÍA WEB", 11, violet, bold);
  y -= 10;
  line(dossier.business?.name ?? "Negocio", 23, slate, bold);
  line([dossier.business?.category, dossier.business?.city, dossier.business?.country].filter(Boolean).join(" · ") || "Datos de ubicación disponibles en el expediente", 10, muted);
  y -= 10;
  heading("Resumen de oportunidad");
  line(dossier.auditBrief?.executiveSummary ?? "Sin resumen disponible.");
  line(`Estado comercial: ${dossier.opportunity?.status ?? "sin estado"} · Prioridad: ${String(dossier.opportunity?.priority ?? "n/d").toUpperCase()} · Opportunity Score: ${dossier.opportunity?.opportunityScore ?? "n/d"}/100`, 10, slate, bold);
  heading("Recomendación de servicio");
  line(dossier.auditBrief?.recommendedEngagement?.title ?? "Auditoría web", 12, slate, bold);
  line(dossier.auditBrief?.recommendedEngagement?.rationale ?? "");
  bullets(dossier.auditBrief?.recommendedEngagement?.suggestedScope);
  const customScope = dossier.auditBrief?.customizedWebScope;
  if (customScope) {
    heading(`Alcance sectorial · ${customScope.name}`);
    line(`${customScope.sector} — ${customScope.overview}`);
    line("Entregables propuestos", 10, slate, bold); bullets(customScope.deliverables);
    line("Indicadores de éxito", 10, slate, bold); bullets(customScope.successMetrics);
  }
  heading("Señales verificables");
  (dossier.auditBrief?.opportunitySignals ?? []).forEach((signal: { signal: string; contribution: number }) => line(`• ${signal.signal}: ${signal.contribution >= 0 ? "+" : ""}${signal.contribution} puntos`));
  heading("Agenda para la auditoría"); bullets(dossier.auditBrief?.auditAgenda);
  heading("Límites operativos"); bullets(dossier.auditBrief?.guardrails);
  y -= 6; line("Documento preparado para revisión humana. No autoriza contacto automático, creación automática de sitios ni entrega externa.", 8, muted);
  return document.save();
}
