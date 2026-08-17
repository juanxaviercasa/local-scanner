import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BarChart3, Compass, History, LayoutDashboard, LogOut, Settings2, ShieldCheck, Target } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";

const navigation = [
  { href: "/app", label: "Visión general", icon: LayoutDashboard },
  { href: "/app/nueva-prospeccion", label: "Nueva prospección", icon: Compass },
  { href: "/app/prospectos", label: "Oportunidades", icon: Target },
  { href: "/app/historial", label: "Historial", icon: History },
  { href: "/app/configuracion", label: "Configuración", icon: Settings2 },
];

function active(location: string, href: string) {
  return href === "/app" ? location === "/app" : location.startsWith(href);
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, loading, isAuthenticated, logout } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f6f7fb]"><div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!isAuthenticated) return <div className="grid min-h-screen place-items-center bg-[#f6f7fb] px-5"><div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-900/5"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><Target size={22} /></span><h1 className="mt-5 text-2xl font-bold tracking-tight">Acceso protegido</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Inicia sesión para consultar tus campañas, oportunidades y límites de consumo.</p><Button className="mt-6 w-full" onClick={() => startLogin()}>Iniciar sesión</Button><Link href="/" className="mt-4 inline-block text-sm font-medium text-primary">Volver al inicio</Link></div></div>;
  const initials = (user?.name || user?.email || "U").slice(0, 2).toUpperCase();
  return <div className="min-h-screen bg-[#f6f7fb] text-slate-900"><aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-slate-200 bg-white p-5 lg:flex"><Link href="/app" className="flex items-center gap-3 px-2"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-sm font-black text-primary-foreground">N</span><span><strong className="block text-sm tracking-tight">NEXO LOCAL</strong><small className="text-[10px] font-bold tracking-[0.16em] text-primary">OPPORTUNITY SCANNER</small></span></Link><nav className="mt-10 space-y-1">{navigation.map(item => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors", active(location, item.href) ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900")}><Icon size={18} />{item.label}</Link>; })}{user?.role === "admin" && <Link href="/app/admin" className={cn("mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold", active(location, "/app/admin") ? "bg-primary text-primary-foreground" : "text-slate-500 hover:bg-slate-100")}><ShieldCheck size={18} />Administración</Link>}</nav><div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">{initials}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{user?.name || "Cuenta Nexo"}</strong><small className="block truncate text-xs text-slate-500">{user?.role === "admin" ? "Administración" : "Operador"}</small></span><button onClick={() => logout()} className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-rose-600" aria-label="Cerrar sesión"><LogOut size={16} /></button></div></div></aside><div className="lg:pl-72"><header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur lg:hidden"><Link href="/app" className="flex items-center gap-2 text-sm font-black"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">N</span>NEXO LOCAL</Link><button onClick={() => logout()} className="rounded-lg p-2 text-slate-500"><LogOut size={17} /></button></header><main className="mx-auto max-w-[1600px] px-5 py-7 sm:px-8 lg:px-10">{children}</main></div></div>;
}
