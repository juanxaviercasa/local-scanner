import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Dossier = Record<string, any>;

const navy = rgb(0.055, 0.09, 0.16);
const violet = rgb(0.31, 0.18, 0.7);
const violetSoft = rgb(0.94, 0.92, 1);
const muted = rgb(0.33, 0.39, 0.48);
const white = rgb(1, 1, 1);
const lineColor = rgb(0.88, 0.9, 0.94);

function wrap(text: string, max = 84) {
  const words = String(text ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
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
  document.setSubject("Expediente de auditoría web para revisión humana");
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page = document.addPage([595.28, 841.89]);
  let y = 770;
  let pageNumber = 1;

  const pageHeader = (label: string) => {
    page.drawRectangle({ x: 0, y: 795, width: 595.28, height: 46.89, color: navy });
    page.drawText("NEXO LOCAL", { x: 48, y: 815, size: 10, font: bold, color: white });
    page.drawText(label.toUpperCase(), { x: 144, y: 815, size: 8, font: bold, color: rgb(0.8, 0.76, 1) });
  };
  const footer = () => {
    page.drawLine({ start: { x: 48, y: 34 }, end: { x: 547, y: 34 }, thickness: 0.7, color: lineColor });
    page.drawText("Uso interno · Requiere revisión humana antes de contacto, propuesta o entrega externa.", { x: 48, y: 20, size: 7.5, font: regular, color: muted });
    page.drawText(`Página ${pageNumber}`, { x: 505, y: 20, size: 7.5, font: regular, color: muted });
  };
  const addPage = (label = "Expediente de auditoría") => {
    footer();
    page = document.addPage([595.28, 841.89]);
    pageNumber += 1;
    pageHeader(label);
    y = 770;
  };
  const line = (text: string, size = 10, color = navy, font = regular, x = 48) => {
    const rows = wrap(text, size >= 18 ? 42 : size >= 13 ? 60 : 86);
    for (const row of rows) {
      if (y < 66) addPage();
      page.drawText(row, { x, y, size, font, color });
      y -= size + 5;
    }
  };
  const heading = (text: string) => {
    if (y < 100) addPage();
    y -= 11;
    line(text, 14, violet, bold);
    page.drawLine({ start: { x: 48, y: y + 2 }, end: { x: 547, y: y + 2 }, thickness: 1, color: violetSoft });
    y -= 9;
  };
  const bullets = (items: string[] | undefined) => (items ?? []).forEach(item => line(`• ${item}`, 10, navy));
  const infoPair = (label: string, value: string, x: number) => {
    page.drawText(label.toUpperCase(), { x, y, size: 7.5, font: bold, color: muted });
    page.drawText(value || "No disponible", { x, y: y - 13, size: 10, font: bold, color: navy });
  };

  page.drawRectangle({ x: 0, y: 718, width: 595.28, height: 123.89, color: navy });
  page.drawRectangle({ x: 48, y: 740, width: 112, height: 23, color: violet });
  page.drawText("AUDITORÍA WEB", { x: 60, y: 748, size: 9, font: bold, color: white });
  page.drawText("NEXO LOCAL", { x: 48, y: 806, size: 10, font: bold, color: rgb(0.8, 0.76, 1) });
  const businessName = dossier.business?.name ?? "Negocio";
  page.drawText(wrap(businessName, 35)[0] ?? businessName, { x: 48, y: 780, size: 23, font: bold, color: white });
  page.drawText([dossier.business?.category, dossier.business?.city, dossier.business?.country].filter(Boolean).join(" · ") || "Ficha de oportunidad local", { x: 48, y: 727, size: 10, font: regular, color: rgb(0.88, 0.9, 0.95) });
  y = 684;
  page.drawRectangle({ x: 48, y: 608, width: 499, height: 58, color: violetSoft });
  page.drawText("OPPORTUNITY SCORE", { x: 62, y: 645, size: 8, font: bold, color: violet });
  page.drawText(`${dossier.opportunity?.opportunityScore ?? "—"}/100`, { x: 62, y: 619, size: 21, font: bold, color: navy });
  infoPair("Prioridad", String(dossier.opportunity?.priority ?? "n/d").toUpperCase(), 215);
  infoPair("Estado comercial", String(dossier.opportunity?.status ?? "sin estado").replaceAll("_", " "), 350);
  y = 577;
  heading("Resumen ejecutivo");
  line(dossier.auditBrief?.executiveSummary ?? "Sin resumen disponible.");
  heading("Ficha del negocio");
  line(`Dirección: ${dossier.business?.address ?? "No disponible"}`);
  line(`Contacto público: ${dossier.business?.phone ?? "No disponible"} · Sitio: ${dossier.business?.website ?? "No disponible"}`);
  line(`Señal web: ${String(dossier.business?.websiteStatus ?? "sin analizar").replaceAll("_", " ")} · Calidad: ${String(dossier.business?.websiteQuality ?? "sin analizar").replaceAll("_", " ")}`);
  heading("Recomendación de servicio");
  line(dossier.auditBrief?.recommendedEngagement?.title ?? "Auditoría web", 12, navy, bold);
  line(dossier.auditBrief?.recommendedEngagement?.rationale ?? "");
  bullets(dossier.auditBrief?.recommendedEngagement?.suggestedScope);

  const customScope = dossier.auditBrief?.customizedWebScope;
  if (customScope) {
    heading(`Alcance sectorial · ${customScope.name}`);
    line(`${customScope.sector} — ${customScope.overview}`);
    line("Entregables propuestos", 10, navy, bold); bullets(customScope.deliverables);
    line("Indicadores de éxito", 10, navy, bold); bullets(customScope.successMetrics);
  }
  heading("Señales verificables");
  (dossier.auditBrief?.opportunitySignals ?? []).forEach((signal: { signal: string; contribution: number }) => line(`• ${signal.signal}: ${signal.contribution >= 0 ? "+" : ""}${signal.contribution} puntos`));
  heading("Criterios de transición");
  const criteria = dossier.readiness?.criteria;
  if (criteria) {
    line(`Resultado: ${dossier.readiness?.eligible ? "APTO PARA REVISIÓN" : "PENDIENTE DE CRITERIOS"}`, 10, dossier.readiness?.eligible ? violet : muted, bold);
    line(`Opportunity Score: ${criteria.score ?? "n/d"}/100 · mínimo configurado: ${criteria.minimumOpportunityScore ?? "n/d"}`);
    line(`Próxima acción: ${criteria.requireNextAction ? (criteria.hasNextAction ? "requisito cumplido" : "requisito pendiente") : "no requerida"}`);
    line(`Evidencia digital: ${criteria.requireDigitalEvidence ? (criteria.hasDigitalEvidence ? "requisito cumplido" : "requisito pendiente") : "no requerida"}`);
  }
  const readinessReasons = dossier.readiness?.reasons as string[] | undefined;
  if (readinessReasons?.length) {
    line("Aspectos pendientes antes de transición", 10, navy, bold);
    bullets(readinessReasons);
  } else {
    line("No se registran bloqueos de aptitud. La revisión humana sigue siendo obligatoria antes de contacto o entrega externa.");
  }
  heading("Agenda para la auditoría"); bullets(dossier.auditBrief?.auditAgenda);
  heading("Entrega y límites operativos");
  line("Estado de entrega: preparado para descarga y revisión humana. El envío a un SaaS requiere una acción explícita y un webhook configurado.", 10, navy, bold);
  bullets(dossier.auditBrief?.guardrails);
  footer();
  return document.save();
}
