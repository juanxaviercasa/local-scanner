import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { ArrowRight, CheckCircle2, FolderKanban, Layers3, ShieldCheck, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

const features = [
  { icon: Layers3, title: "Visión unificada", text: "Proyectos, tareas y entregables reunidos en un único espacio de decisión." },
  { icon: FolderKanban, title: "Ejecución trazable", text: "Convierte el trabajo diario en acciones visibles, responsables y medibles." },
  { icon: ShieldCheck, title: "Control con criterio", text: "Acceso autenticado, roles definidos y actividad relevante registrada." },
];

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const goToWorkspace = () => isAuthenticated ? setLocation("/app") : startLogin();

  return (
    <div className="min-h-screen overflow-hidden bg-[#f7f8fb] text-[#17213a] dark:bg-background dark:text-foreground">
      <header className="container flex h-20 items-center justify-between">
        <button onClick={() => setLocation("/")} className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#233e75] text-sm font-extrabold text-white">N</span><span className="text-sm font-extrabold tracking-tight">Nexo Ops</span></button>
        <div className="flex items-center gap-2"><Button variant="ghost" className="hidden sm:inline-flex" onClick={goToWorkspace}>{isAuthenticated ? "Ir al espacio" : "Iniciar sesión"}</Button><Button onClick={goToWorkspace}>{isAuthenticated ? "Abrir Nexo" : "Comenzar"}<ArrowRight size={16} /></Button></div>
      </header>
      <main>
        <section className="container relative grid-noise overflow-hidden rounded-[2rem] border border-[#dce2ef] bg-[radial-gradient(circle_at_76%_20%,oklch(0.83_0.1_205_/_0.45),transparent_28%),linear-gradient(130deg,#edf2fb_0%,#f9fafc_58%,#e5f2f3_100%)] px-6 pb-12 pt-16 sm:px-12 sm:pt-24 lg:min-h-[590px] lg:px-16">
          <div className="relative z-10 max-w-3xl reveal"><p className="eyebrow">Dirección con claridad</p><h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-[-0.045em] text-[#17213a] sm:text-6xl">El trabajo importante merece un centro de gravedad.</h1><p className="mt-6 max-w-xl text-base leading-7 text-[#536078] sm:text-lg">Nexo Ops ofrece a los equipos una perspectiva operativa nítida: menos ruido, más contexto y decisiones que avanzan.</p><div className="mt-9 flex flex-wrap gap-3"><Button size="lg" className="h-12 px-6" onClick={goToWorkspace}>{isAuthenticated ? "Entrar al espacio" : "Iniciar sesión"}<ArrowRight size={17} /></Button><a href="#capacidades" className="inline-flex h-12 items-center justify-center rounded-xl border border-[#c9d2e3] bg-white/65 px-5 text-sm font-semibold text-[#344463] backdrop-blur transition-colors hover:bg-white">Conocer Nexo</a></div><div className="mt-12 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#52607a]"><span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#2a8d9b]" />Proyectos conectados</span><span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#2a8d9b]" />Acceso protegido</span><span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#2a8d9b]" />Ejecución visible</span></div></div>
          <div className="relative z-10 mt-14 max-w-md rounded-2xl border border-white/70 bg-white/75 p-5 shadow-[0_22px_55px_-26px_rgba(29,55,110,.42)] backdrop-blur lg:absolute lg:bottom-12 lg:right-14 lg:mt-0"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-[#64728c]">Radar operativo</p><p className="mt-1 font-bold">Todo bajo control</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#dff4f1] text-[#207b83]"><Sparkles size={18} /></span></div><div className="mt-5 space-y-2"><div className="h-2 rounded-full bg-[#dfe7f2]"><div className="h-2 w-[76%] rounded-full bg-[#29497f]" /></div><div className="flex justify-between text-xs text-[#65738b]"><span>Flujo de trabajo</span><strong className="font-mono font-medium text-[#243c6e]">En curso</strong></div></div></div>
        </section>
        <section id="capacidades" className="container py-24 sm:py-32"><div className="max-w-xl"><p className="eyebrow">Una forma más serena de operar</p><h2 className="mt-4 text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">Una estructura pensada para el ritmo real de tu equipo.</h2></div><div className="mt-12 grid gap-4 md:grid-cols-3">{features.map(feature => <article key={feature.title} className="surface p-7"><span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><feature.icon size={20} /></span><h3 className="mt-7 text-lg font-bold tracking-tight">{feature.title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{feature.text}</p></article>)}</div></section>
        <section className="container pb-24"><div className="rounded-[1.75rem] bg-[#1d325f] px-7 py-12 text-center text-white sm:px-12"><p className="eyebrow text-[#9be0d6]">Preparado para avanzar</p><h2 className="mx-auto mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">Da a cada iniciativa el enfoque que necesita.</h2><p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/70">Tu centro de operaciones está listo cuando lo esté tu equipo.</p><Button size="lg" onClick={goToWorkspace} className="mt-8 bg-[#9be0d6] text-[#18305f] hover:bg-[#b8eee6]">{isAuthenticated ? "Abrir Nexo Ops" : "Acceder a Nexo Ops"}<ArrowRight size={16} /></Button></div></section>
      </main>
      <footer className="border-t border-[#dce2ef] py-7"><div className="container flex flex-wrap justify-between gap-3 text-xs text-muted-foreground"><span>© {new Date().getFullYear()} Nexo Ops</span><span>Gestión de proyectos con intención.</span></div></footer>
    </div>
  );
}
