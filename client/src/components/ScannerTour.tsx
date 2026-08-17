import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Check, Circle, Compass, RotateCcw, Route } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

const steps = [
  { href: "/app/nueva-prospeccion", title: "1. Incorpora una fuente autorizada", detail: "Comienza con CSV o entrada manual; el proveedor oficial sigue siendo opcional.", action: "Abrir prospección" },
  { href: "/app/prospectos", title: "2. Revisa y cualifica oportunidades", detail: "Contrasta el score con las señales disponibles y registra una próxima acción comercial.", action: "Abrir oportunidades" },
  { href: "/app/configuracion", title: "3. Calibra cuando tengas cierres reales", detail: "Usa el CSV de resultados para revisar sugerencias; los pesos nunca cambian sin confirmación.", action: "Abrir configuración" },
  { href: "/app/transiciones", title: "4. Prepara la auditoría web", detail: "Configura los criterios, aprueba el expediente y revisa el alcance recomendado.", action: "Abrir transición" },
  { href: "/app/transiciones", title: "5. Entrega por un canal autorizado", detail: "Descarga el expediente JSON o habilita el conector solo cuando el SaaS externo esté configurado.", action: "Ver expedientes" },
] as const;

export default function ScannerTour() {
  const [completed, setCompleted] = useState<number[]>([]);
  const progress = trpc.guide.progress.useQuery();
  const saveProgress = trpc.guide.updateProgress.useMutation({ onSuccess: data => setCompleted(data.completedSteps) });
  useEffect(() => { if (progress.data) setCompleted(progress.data.completedSteps); }, [progress.data]);
  const completion = useMemo(() => Math.round((completed.length / steps.length) * 100), [completed.length]);
  const update = (step: number) => {
    const next = completed.includes(step) ? completed.filter(value => value !== step) : [...completed, step].sort((a, b) => a - b);
    setCompleted(next);
    saveProgress.mutate({ completedSteps: next });
  };
  const reset = () => { setCompleted([]); saveProgress.mutate({ completedSteps: [] }); };

  return <section className="overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 shadow-sm" aria-labelledby="tour-title">
    <div className="border-b border-violet-100 px-5 py-5 sm:px-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Route size={19} /></span><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Recorrido guiado</p><h2 id="tour-title" className="mt-1 text-xl font-bold text-slate-950">Opera Nexo Local paso a paso</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Marca cada paso cuando lo hayas revisado. El avance se guarda en tu cuenta y se sincroniza entre sesiones; no modifica oportunidades ni configura conectores.</p></div></div><div className="flex items-center gap-3"><strong className="text-sm text-primary">{progress.isSuccess ? `${completion}%` : "…"}</strong><Button size="sm" variant="outline" disabled={saveProgress.isPending} onClick={reset}><RotateCcw size={15} />Reiniciar</Button></div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-violet-100" aria-label={`Progreso del recorrido: ${completion}%`}><div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${completion}%` }} /></div></div>
    <ol className="divide-y divide-violet-100">{steps.map((step, index) => { const isDone = completed.includes(index); return <li key={step.title} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="flex min-w-0 gap-3"><button type="button" onClick={() => update(index)} className="mt-0.5 rounded-full text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" aria-label={`${isDone ? "Marcar pendiente" : "Marcar completado"}: ${step.title}`}>{isDone ? <Check className="rounded-full bg-emerald-600 p-1 text-white" size={22} /> : <Circle size={22} />}</button><div><h3 className="font-bold text-slate-900">{step.title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{step.detail}</p></div></div><Link href={step.href} className="inline-flex shrink-0 items-center justify-center rounded-md px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5">{step.action}<Compass className="ml-1.5" size={15} /></Link></li>; })}</ol>
  </section>;
}
