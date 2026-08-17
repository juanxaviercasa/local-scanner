import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Activity,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  UploadCloud,
  X,
  CheckSquare,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const navigation = [
  { label: "Resumen", path: "/app", icon: LayoutDashboard },
  { label: "Proyectos", path: "/app/proyectos", icon: FolderKanban },
  { label: "Tareas", path: "/app/tareas", icon: CheckSquare },
  { label: "Archivos", path: "/app/archivos", icon: UploadCloud },
  { label: "Actividad", path: "/app/actividad", icon: Activity },
];

function initials(name?: string | null) {
  return name?.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase() || "NX";
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,oklch(0.9_0.08_205_/_0.28),transparent_40%)] p-6">
        <section className="surface w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground font-bold">N</div>
          <p className="eyebrow">Espacio privado</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Accede a tu centro de operaciones.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Inicia sesión para continuar con tus proyectos, tareas y archivos.</p>
          <Button onClick={() => startLogin()} className="mt-7 w-full">Iniciar sesión</Button>
        </section>
      </main>
    );
  }

  const isAdmin = user.role === "admin";
  const activeItems = [...navigation, { label: "Perfil", path: "/app/perfil", icon: Settings }, ...(isAdmin ? [{ label: "Administración", path: "/app/admin", icon: ShieldCheck }] : [])];
  const currentTitle = activeItems.find(item => item.path === location)?.label ?? "Nexo Ops";

  const sideContent = (
    <>
      <div className="flex h-20 items-center justify-between px-5">
        <button onClick={() => { setLocation("/app"); setMobileOpen(false); }} className="flex items-center gap-3 text-left" aria-label="Ir al resumen">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-sidebar-primary font-bold text-sidebar-primary-foreground shadow-lg shadow-black/10">N</span>
          <span><strong className="block text-sm tracking-tight text-sidebar-foreground">Nexo Ops</strong><small className="font-mono text-[10px] uppercase tracking-widest text-sidebar-foreground/55">Workspace</small></span>
        </button>
        <button onClick={() => setMobileOpen(false)} className="lg:hidden text-sidebar-foreground/70" aria-label="Cerrar menú"><X size={18} /></button>
      </div>
      <nav className="px-3 py-2" aria-label="Navegación principal">
        <p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/45">Espacio de trabajo</p>
        <div className="space-y-1">
          {activeItems.map(item => {
            const active = location === item.path;
            return (
              <button key={item.path} onClick={() => { setLocation(item.path); setMobileOpen(false); }} className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${active ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
                <item.icon size={17} strokeWidth={active ? 2.4 : 1.8} /><span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      <div className="mt-auto p-3">
        <Separator className="mb-3 bg-sidebar-border" />
        <button onClick={() => setLocation("/app/perfil")} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-sidebar-accent">
          <Avatar className="h-9 w-9 border border-sidebar-border"><AvatarImage src={user.avatarUrl ?? undefined} /><AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-accent-foreground">{initials(user.name)}</AvatarFallback></Avatar>
          <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-sidebar-foreground">{user.name || "Tu perfil"}</strong><small className="block truncate text-xs text-sidebar-foreground/55">{user.email || "Sesión protegida"}</small></span>
          <Tooltip><TooltipTrigger asChild><button onClick={event => { event.stopPropagation(); logout(); }} className="rounded-lg p-2 text-sidebar-foreground/55 hover:bg-sidebar hover:text-sidebar-foreground" aria-label="Cerrar sesión"><LogOut size={15} /></button></TooltipTrigger><TooltipContent>Cerrar sesión</TooltipContent></Tooltip>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col bg-sidebar lg:flex">{sideContent}</aside>
      {mobileOpen && <div className="fixed inset-0 z-50 flex lg:hidden"><button className="absolute inset-0 bg-foreground/35 backdrop-blur-[1px]" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" /><aside className="relative flex w-[284px] flex-col bg-sidebar shadow-2xl">{sideContent}</aside></div>}
      <div className="min-w-0 flex-1 lg:ml-[252px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/85 px-4 backdrop-blur-md sm:px-7">
          <div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menú"><Menu size={20} /></Button><div><p className="text-sm font-bold tracking-tight">{currentTitle}</p><p className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:block">Nexo Ops / {currentTitle}</p></div></div>
          <div className="flex items-center gap-2"><span className="hidden rounded-full bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300 sm:inline">Espacio seguro</span><Avatar className="h-8 w-8"><AvatarImage src={user.avatarUrl ?? undefined} /><AvatarFallback className="bg-accent text-[10px] text-accent-foreground">{initials(user.name)}</AvatarFallback></Avatar></div>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 sm:p-7">{children}</main>
      </div>
    </div>
  );
}
