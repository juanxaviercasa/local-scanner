import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { dateTimeLabel, PageHeading, StatusPill } from "@/components/WorkspaceUI";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CheckCircle2, CircleAlert, FolderKanban, ListChecks, Plus, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const metrics = trpc.dashboard.metrics.useQuery();
  const projects = trpc.projects.list.useQuery();
  const activity = trpc.activity.list.useQuery({ limit: 5 });
  const cards = [
    { label: "Proyectos activos", value: metrics.data?.activeProjects, icon: FolderKanban, tone: "text-primary bg-primary/10" },
    { label: "Tareas pendientes", value: metrics.data?.pendingTasks, icon: ListChecks, tone: "text-violet-700 bg-violet-500/10 dark:text-violet-300" },
    { label: "Tareas completadas", value: metrics.data?.completedTasks, icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-500/10 dark:text-emerald-300" },
    { label: "Requieren atención", value: metrics.data?.overdueTasks, icon: CircleAlert, tone: "text-orange-700 bg-orange-500/10 dark:text-orange-300" },
  ];
  return <>
    <PageHeading eyebrow="Visión operativa" title="Buenos días. Todo empieza con claridad." text="Este es el pulso actual de tu espacio de trabajo." actions={<><Button variant="outline" onClick={() => setLocation("/app/tareas")}>Ver tareas</Button><Button onClick={() => setLocation("/app/proyectos")}><Plus size={16} />Nuevo proyecto</Button></>} />
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(card => <article className="surface p-5" key={card.label}><div className="flex items-start justify-between"><p className="text-sm font-medium text-muted-foreground">{card.label}</p><span className={`grid h-9 w-9 place-items-center rounded-xl ${card.tone}`}><card.icon size={18} /></span></div>{metrics.isLoading ? <Skeleton className="mt-5 h-8 w-12" /> : <p className="mt-5 text-3xl font-extrabold tracking-tight">{card.value ?? 0}</p>}</article>)}</section>
    <section className="mt-7 grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
      <article className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-border/75 px-6 py-5"><div><p className="font-bold tracking-tight">Proyectos recientes</p><p className="mt-1 text-xs text-muted-foreground">Lo que está moviendo tu trabajo.</p></div><Button variant="ghost" size="sm" onClick={() => setLocation("/app/proyectos")}>Ver todos<ArrowRight size={14} /></Button></div><div className="divide-y divide-border/70">{projects.isLoading ? [1, 2, 3].map(key => <div key={key} className="flex gap-4 p-5"><Skeleton className="h-10 w-10 rounded-xl" /><div className="space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-24" /></div></div>) : projects.data?.length ? projects.data.slice(0, 4).map(project => <button key={project.id} className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-muted/45" onClick={() => setLocation("/app/tareas?project=" + project.id)}><span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><FolderKanban size={18} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{project.name}</strong><small className="mt-1 block truncate text-xs text-muted-foreground">{project.description || "Sin descripción"}</small></span><StatusPill value={project.status} /></button>) : <div className="px-6 py-12 text-center text-sm text-muted-foreground">Aún no hay proyectos. Crea el primero para comenzar.</div>}</div></article>
      <article className="surface"><div className="border-b border-border/75 px-6 py-5"><p className="font-bold tracking-tight">Actividad reciente</p><p className="mt-1 text-xs text-muted-foreground">Los movimientos relevantes del espacio.</p></div><div className="p-5">{activity.isLoading ? <div className="space-y-5">{[1,2,3].map(key => <Skeleton key={key} className="h-11 w-full" />)}</div> : activity.data?.length ? <div className="space-y-5">{activity.data.map(({ activity: event, actorName }) => <div key={event.id} className="flex gap-3"><span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Sparkles size={13} /></span><div><p className="text-sm leading-5">{event.summary}</p><p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{actorName || "Usuario"} · {dateTimeLabel(event.createdAt)}</p></div></div>)}</div> : <p className="py-7 text-center text-sm text-muted-foreground">Cuando comiences a trabajar, los movimientos aparecerán aquí.</p>}</div></article>
    </section>
  </>;
}
