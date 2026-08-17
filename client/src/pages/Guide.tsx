import DashboardLayout from "@/components/DashboardLayout";
import ScannerTour from "@/components/ScannerTour";
import { PageHeader } from "@/components/ScannerUI";
import { Button } from "@/components/ui/button";
import { BookOpenCheck, CircleHelp, FileCheck2, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

const quickGuide = [
  { number: "01", title: "Prospecta con fuentes autorizadas", text: "Importa un CSV o crea registros manuales. Google Places solo se usa si tú activas el conector oficial y sus límites.", href: "/app/nueva-prospeccion", action: "Ir a prospección" },
  { number: "02", title: "Convierte señales en seguimiento", text: "Revisa las razones del Opportunity Score, clasifica el prospecto y programa una próxima acción. Los recordatorios son internos.", href: "/app/prospectos", action: "Ver oportunidades" },
  { number: "03", title: "Ajusta el score con evidencia", text: "Cuando dispongas de cierres reales autorizados, usa el panel de calibración. Revisa la recomendación y confirma el cambio de pesos.", href: "/app/configuracion", action: "Calibrar score" },
  { number: "04", title: "Prepara una auditoría, no un envío automático", text: "La transición evalúa los criterios, crea un expediente con alcance recomendado y requiere aprobación humana antes de una entrega manual o externa.", href: "/app/transiciones", action: "Abrir transición" },
];

export default function Guide() {
  return <DashboardLayout><PageHeader eyebrow="Centro de ayuda" title="Guía de operación" description="Una referencia integrada para transformar datos autorizados en oportunidades revisadas y expedientes de auditoría, sin activar comunicaciones ni conectores por accidente." actions={<Link href="/app/transiciones"><Button><FileCheck2 size={16} />Ver expedientes</Button></Link>} />
    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-white"><BookOpenCheck size={20} /></span><div><h2 className="text-xl font-bold">Cómo se utiliza Nexo Local</h2><p className="mt-1 text-sm leading-6 text-slate-600">Cada fase deja una trazabilidad clara: fuente, señales, score, seguimiento y decisión de transición.</p></div></div><div className="mt-6 grid gap-3">{quickGuide.map(item => <article key={item.number} className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-start gap-4"><span className="text-sm font-black text-primary">{item.number}</span><div className="min-w-0 flex-1"><h3 className="font-bold text-slate-900">{item.title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p><Link href={item.href} className="mt-3 inline-flex text-sm font-bold text-primary hover:underline">{item.action}</Link></div></div></article>)}</div></section>
      <aside className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6"><div className="flex gap-3"><ShieldCheck className="mt-0.5 text-amber-700" size={21} /><div><h2 className="font-bold text-amber-950">Límites que protegen tu operación</h2><p className="mt-1 text-sm leading-6 text-amber-900">La aplicación no realiza scraping, no envía mensajes, no aplica pesos de producción sola y no entrega datos al SaaS externo sin una acción explícita.</p></div></div><div className="mt-5 rounded-2xl border border-amber-200 bg-white/70 p-4"><div className="flex gap-2 text-sm font-bold text-amber-950"><CircleHelp size={17} />Sobre el expediente de auditoría</div><p className="mt-2 text-sm leading-6 text-amber-900">El expediente 2.0 reúne señales verificables, un alcance web recomendado, preguntas de auditoría, checklist para el SaaS receptor y límites de uso. Es una base para revisión humana, no una propuesta automática.</p></div><Link href="/app/transiciones" className="mt-5 inline-flex text-sm font-bold text-amber-800 hover:underline">Configurar criterios y expedientes</Link></aside></div>
    <div className="mt-6"><ScannerTour /></div>
  </DashboardLayout>;
}
