import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Download, FileUp, SlidersHorizontal, Sparkles } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type CalibrationRow = { outcome: "won" | "lost"; noWebsite: boolean | null; weakWebsite: boolean | null; reviewCount: number | null; rating: number | null; hasPhone: boolean | null; hasBooking: boolean | null; hasWhatsapp: boolean | null; commercialPotential: "low" | "medium" | "high" | "very_high" | null };

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const booleanValue = (value?: string) => value === undefined || !value.trim() ? null : ["si", "sí", "true", "1", "yes", "x"].includes(value.trim().toLowerCase());
const numericValue = (value?: string) => { const number = Number((value ?? "").replace(",", ".")); return Number.isFinite(number) ? number : null; };
const read = (cells: string[], columns: string[], names: string[]) => { const index = columns.findIndex(column => names.includes(column)); return index >= 0 ? cells[index] : undefined; };
const validationExampleCsv = `resultado,sin_sitio,sitio_debil,telefono,reservas,whatsapp,potencial_comercial
ganado,si,si,si,no,no,high
ganado,si,si,si,no,no,high
ganado,si,no,si,si,no,high
ganado,si,no,si,no,si,very_high
ganado,si,si,si,no,si,high
perdido,no,no,si,si,si,low
perdido,no,no,no,si,si,low
perdido,no,si,no,si,si,medium
perdido,no,no,si,si,no,low
perdido,no,no,no,no,si,medium`;

const calibrationTemplateCsv = `resultado,sin_sitio,sitio_debil,resenas,calificacion,telefono,reservas,whatsapp,potencial_comercial
ganado,,,,,,,,
perdido,,,,,,,,
ganado,,,,,,,,
perdido,,,,,,,,
ganado,,,,,,,,
perdido,,,,,,,,
ganado,,,,,,,,
perdido,,,,,,,,`;

function downloadCalibrationTemplate() {
  const url = URL.createObjectURL(new Blob([calibrationTemplateCsv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "plantilla-calibracion-nexo.csv"; anchor.click(); URL.revokeObjectURL(url);
}

function parseCalibrationCsv(value: string): CalibrationRow[] {
  const lines = value.split(/\r?\n/).filter(Boolean); if (lines.length < 2) return [];
  const separator = lines[0].includes(";") ? ";" : ","; const columns = lines[0].split(separator).map(normalize);
  return lines.slice(1).map(line => {
    const cells = line.split(separator).map(cell => cell.replace(/^"|"$/g, "").trim()); const result = normalize(read(cells, columns, ["resultado", "outcome", "result"]) ?? "");
    const outcome: CalibrationRow["outcome"] | null = ["ganado", "won"].includes(result) ? "won" : ["perdido", "lost"].includes(result) ? "lost" : null;
    const potential = normalize(read(cells, columns, ["potencialcomercial", "commercialpotential"]) ?? "");
    if (!outcome) return null;
    return { outcome, noWebsite: booleanValue(read(cells, columns, ["sinsitio", "nositio", "nowebsite"])), weakWebsite: booleanValue(read(cells, columns, ["sitiodebil", "weakwebsite"])), reviewCount: numericValue(read(cells, columns, ["resenas", "reviewcount", "reviews"])), rating: numericValue(read(cells, columns, ["calificacion", "rating"])), hasPhone: booleanValue(read(cells, columns, ["telefono", "hasphone"])), hasBooking: booleanValue(read(cells, columns, ["reservas", "hasbooking"])), hasWhatsapp: booleanValue(read(cells, columns, ["whatsapp", "haswhatsapp"])), commercialPotential: (["low", "medium", "high", "veryhigh"] as string[]).includes(potential) ? (potential === "veryhigh" ? "very_high" : potential) as Exclude<CalibrationRow["commercialPotential"], null> : null };
  }).filter((row): row is CalibrationRow => Boolean(row));
}

export function ScoringCalibrationPanel({ disabled, onApply }: { disabled: boolean; onApply: (weights: Record<string, number>) => void }) {
  const startsWithExample = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("ejemploCalibracion") === "1";
  const [csv, setCsv] = useState(startsWithExample ? validationExampleCsv : ""); const [fileName, setFileName] = useState(startsWithExample ? "ejemplo-calibracion-local.csv" : ""); const rows = useMemo(() => parseCalibrationCsv(csv), [csv]);
  const calibration = trpc.settings.calibrateScoring.useMutation({ onError: error => toast.error(error.message) });
  const autoCalibrationStarted = useRef(false);
  const selectFile = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 2 * 1024 * 1024) return toast.error("El CSV de calibración no puede superar 2 MB."); const reader = new FileReader(); reader.onload = () => { setCsv(String(reader.result ?? "")); setFileName(file.name); calibration.reset(); }; reader.readAsText(file); };
  const normalizedRows = rows.map(row => ({ outcome: row.outcome, noWebsite: row.noWebsite, weakWebsite: row.weakWebsite, reviewCount: row.reviewCount, rating: row.rating, hasPhone: row.hasPhone, hasBooking: row.hasBooking, hasWhatsapp: row.hasWhatsapp, commercialPotential: row.commercialPotential }));
  useEffect(() => { if (startsWithExample && rows.length >= 8 && !autoCalibrationStarted.current) { autoCalibrationStarted.current = true; calibration.mutate({ rows: normalizedRows }); } }, [startsWithExample, rows.length, calibration, normalizedRows]);
  const loadExample = () => { setCsv(validationExampleCsv); setFileName("ejemplo-calibracion-local.csv"); calibration.reset(); toast.success("Ejemplo local cargado: 10 cierres sintéticos sin reseñas ni calificaciones."); };
  return <section className="rounded-3xl border border-cyan-200 bg-cyan-50/45 p-6 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-100 text-cyan-800"><SlidersHorizontal size={18} /></span><div><h2 className="font-bold">Calibrar con resultados reales</h2><p className="mt-1 text-sm text-slate-600">Sube un CSV local de oportunidades cerradas; no se almacena ni se envía a proveedores externos.</p></div></div><div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950"><p><strong>Antes de empezar:</strong> descarga la plantilla, reemplaza las filas vacías con cierres autorizados y conserva al menos 8 resultados etiquetados como ganado o perdido.</p><Button className="mt-3" variant="outline" size="sm" onClick={downloadCalibrationTemplate}><Download size={15} />Descargar plantilla CSV</Button></div><div className="mt-3 rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-700"><p><strong>Ejemplo de validación:</strong> usa 10 cierres sintéticos para comprobar el cálculo. No incluye reseñas, calificaciones ni datos de negocios reales.</p><Button className="mt-3" variant="outline" size="sm" onClick={loadExample}><Sparkles size={15} />Cargar ejemplo seguro</Button></div><div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]"><label className="rounded-2xl border border-dashed border-cyan-300 bg-white/80 p-4 text-sm font-semibold text-slate-700">{fileName || "Seleccionar CSV de resultados"}<Input className="mt-2 cursor-pointer" type="file" accept=".csv,text/csv" onChange={selectFile} /><span className="mt-2 block text-xs font-normal leading-5 text-slate-500">Encabezado requerido: resultado (ganado/perdido). Señales opcionales: sin_sitio, sitio_debil, reseñas, calificación, teléfono, reservas, whatsapp, potencial_comercial.</span></label><Button className="self-start" disabled={disabled || rows.length < 8 || calibration.isPending} onClick={() => calibration.mutate({ rows: normalizedRows })}><FileUp size={16} />{calibration.isPending ? "Calculando…" : `Validar y calibrar ${rows.length || ""} filas`}</Button></div>{csv && rows.length < 8 && <p className="mt-3 text-sm text-amber-800">Se detectaron {rows.length} filas válidas. Se requieren al menos 8 resultados con “ganado” o “perdido”.</p>}{csv && rows.length >= 8 && <p className="mt-3 text-sm text-emerald-800">El archivo contiene {rows.length} cierres válidos y se procesará localmente solo al seleccionar “Validar y calibrar”.</p>}{calibration.data && <div className="mt-5 rounded-2xl bg-white p-4"><p className="text-sm font-bold text-slate-900">Muestra: {calibration.data.validRows} cierres; conversión observada: {(calibration.data.conversionRate * 100).toFixed(0)}%; señales comparables: {calibration.data.stableFactors}.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{calibration.data.explanations.map(item => <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600" key={item.key}>{item.label}: peso sugerido <strong>{item.recommendedWeight}</strong> · {(item.conversionRate * 100).toFixed(0)}% de conversión en {item.matchedRows} casos.</p>)}</div><Button className="mt-4" onClick={() => onApply(calibration.data.recommendedWeights)}>Aplicar pesos sugeridos</Button></div>}</section>;
}
