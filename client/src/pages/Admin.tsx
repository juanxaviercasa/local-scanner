import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, PageHeader, localDate } from "@/components/ScannerUI";
import { trpc } from "@/lib/trpc";
import { UsersRound } from "lucide-react";
import { toast } from "sonner";

export default function Admin() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const users = trpc.admin.users.useQuery(undefined, { enabled: isAdmin });
  const utils = trpc.useUtils();
  const update = trpc.admin.updateRole.useMutation({
    onSuccess: () => { utils.admin.users.invalidate(); toast.success("Rol actualizado."); },
    onError: error => toast.error(error.message),
  });

  return <DashboardLayout>
    <PageHeader eyebrow="Acceso privilegiado" title="Administración" description="Gestiona los roles del espacio. El servidor verifica el rol administrador antes de exponer o modificar estos datos." />
    {!isAdmin ? <EmptyState title="Acceso restringido" description="Esta ruta está reservada para cuentas administradoras y no expone datos administrativos a usuarios estándar." /> : <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 p-6"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-700"><UsersRound size={18} /></span><div><h2 className="font-bold">Usuarios del scanner</h2><p className="mt-1 text-sm text-slate-500">Las personas aparecen después de su primer acceso autorizado.</p></div></div>
      <div className="divide-y divide-slate-100">{users.data?.map(member => <div className="flex flex-wrap items-center gap-4 p-5" key={member.id}>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">{(member.name || member.email || "U").slice(0, 2).toUpperCase()}</span>
        <span className="min-w-48 flex-1"><strong className="block text-sm">{member.name || "Sin nombre"}</strong><small className="text-xs text-slate-500">{member.email || "Sin correo"} · Último acceso {localDate(member.lastSignedIn)}</small></span>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={member.role} onChange={event => update.mutate({ userId: member.id, role: event.target.value as "admin" | "user" })} disabled={update.isPending || member.id === user?.id}><option value="user">Usuario</option><option value="admin">Administrador</option></select>
      </div>)}</div>
    </section>}
  </DashboardLayout>;
}
