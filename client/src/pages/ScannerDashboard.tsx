import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, MetricCard, PageHeader, localDate } from "@/components/ScannerUI";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, CheckCircle2, Compass, Sparkles } from "lucide-react";
import { Link } from "wouter";

export default function ScannerDashboard() {
  const metrics = trpc.dashboard.metrics.useQuery();
  const runs = trpc.dashboard.recentRuns.useQuery();
  const summary = metrics.data;
  const isNewWorkspace = !metrics.isLoading && (summary?.totalRuns ?? 0) === 0;

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Centro de inteligencia"
        title="Tus oportunidades locales, en contexto."
        description="Lanza prospecciones controladas y convierte los resultados disponibles en una cola priorizada de conversaciones comerciales."
        actions={<Link href="/app/nueva-prospeccion"><Button><Compass size={16} />Nueva prospección</Button></Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.isLoading ? [1, 2, 3, 4].map(item => <div className="h-40 animate-pulse rounded-2xl bg-slate-200" key={item} />) : <>
          <MetricCard label="Prospecciones" value={summary?.totalRuns ?? 0} note="Ejecuciones conservadas en tu historial" />
          <MetricCard label="Negocios únicos" value={summary?.unique ?? 0} note="Resultados deduplicados y conservados" tone="violet" />
          <MetricCard label="Sin sitio web" value={summary?.withoutWebsite ?? 0} note="Señal directa para una oportunidad digital" tone="amber" />
          <MetricCard label="Score promedio" value={summary?.averageScore ?? 0} note={`P0 ${summary?.p0 ?? 0} · P1 ${summary?.p1 ?? 0} · P2 ${summary?.p2 ?? 0}`} tone="emerald" />
        </>}
      </div>

      {isNewWorkspace && <section className="mt-8 rounded-3xl border border-violet-200 bg-violet-50 p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">Primera prospección</p>
        <h2 className="mt-2 text-xl font-bold">Tres pasos para empezar sin perder el control.</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            ["Ajusta límites", "Define el volumen y coste máximo que aceptarás por ejecución."],
            ["Delimita la zona", "Elige ciudad, distrito, categoría y señales que quieres priorizar."],
            ["Confirma el plan", "Revisa operaciones y coste antes de consultar la fuente autorizada."],
          ].map(([title, text]) => <div className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm" key={title}>
            <CheckCircle2 className="shrink-0 text-violet-600" size={19} />
            <span><strong className="block text-sm">{title}</strong><small className="mt-1 block text-xs leading-5 text-slate-500">{text}</small></span>
          </div>)}
        </div>
      </section>}

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Últimas ejecuciones</p><h2 className="mt-2 text-xl font-bold">Historial de prospección</h2></div>
            <Link href="/app/historial" className="text-sm font-bold text-primary">Ver todo</Link>
          </div>
          <div className="mt-6 divide-y divide-slate-100">
            {runs.data?.length ? runs.data.map(run => <Link key={run.id} href={`/app/historial/${run.id}`} className="flex items-center gap-4 py-4 first:pt-0">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-primary"><Sparkles size={17} /></span>
              <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{run.primaryCategory} · {run.district || run.city}</strong><small className="block text-xs text-slate-500">{localDate(run.createdAt)} · {run.uniqueCount} únicos · {run.status}</small></span>
              <ArrowUpRight size={17} className="text-slate-400" />
            </Link>) : <EmptyState title="Todavía no hay prospecciones" description="Empieza delimitando una zona y una categoría para crear tu primera lista priorizada." href="/app/nueva-prospeccion" action="Crear la primera" />}
          </div>
        </article>
        <article className="rounded-3xl bg-slate-950 p-6 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-300">Principio del scanner</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">Señales comprobables, no datos inventados.</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">Nexo separa datos recibidos de inferencias. Si no puede verificar una web, una red o una reserva, conserva el estado como no encontrado o no analizado.</p>
          <Link href="/app/configuracion" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-violet-300">Configurar límites y puntuación <ArrowUpRight size={15} /></Link>
        </article>
      </section>
    </DashboardLayout>
  );
}
