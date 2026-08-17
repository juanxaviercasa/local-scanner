import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { FolderOpen, Plus } from "lucide-react";

export const projectStatusLabel = { active: "Activo", paused: "Pausado", completed: "Completado" } as const;
export const taskStatusLabel = { todo: "Pendiente", in_progress: "En curso", done: "Completada" } as const;
export const priorityLabel = { low: "Baja", medium: "Media", high: "Alta", urgent: "Urgente" } as const;

const tones: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", paused: "bg-amber-500/10 text-amber-700 dark:text-amber-300", completed: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  todo: "bg-slate-500/10 text-slate-600 dark:text-slate-300", in_progress: "bg-violet-500/10 text-violet-700 dark:text-violet-300", done: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  low: "bg-slate-500/10 text-slate-600 dark:text-slate-300", medium: "bg-sky-500/10 text-sky-700 dark:text-sky-300", high: "bg-orange-500/10 text-orange-700 dark:text-orange-300", urgent: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export function StatusPill({ value, label }: { value: string; label?: string }) { return <span className={cn("inline-flex rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider", tones[value] ?? "bg-muted text-muted-foreground")}>{label ?? value}</span>; }
export function EmptyWorkspace({ title, text, action }: { title: string; text: string; action?: () => void }) { return <Empty className="surface min-h-[280px] border-dashed py-12"><EmptyHeader><EmptyMedia variant="icon"><FolderOpen /></EmptyMedia><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{text}</EmptyDescription></EmptyHeader>{action && <Button variant="outline" onClick={action}><Plus size={15} />Crear primero</Button>}</Empty>; }
export function PageHeading({ eyebrow, title, text, actions }: { eyebrow?: string; title: string; text: string; actions?: React.ReactNode }) { return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">{eyebrow ?? "Nexo Ops"}</p><h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{text}</p></div>{actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}</div>; }
export function dateLabel(value?: Date | string | null) { return value ? new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "Sin fecha"; }
export function dateTimeLabel(value?: Date | string | null) { return value ? new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : ""; }
