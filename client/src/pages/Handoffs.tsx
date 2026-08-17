import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, PageHeader, PriorityPill } from "@/components/ScannerUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { BookOpenCheck, CheckCircle2, Download, ExternalLink, FileCheck2, FileDown, LockKeyhole, Pencil, Save, Send, Settings2, ShieldCheck, Trash2, Waypoints, Webhook } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

function downloadJson(filename: string, dossier: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(dossier, null, 2)], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadPdf(filename: string, contentBase64: string) {
  const binary = window.atob(contentBase64);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Handoffs() {
  const utils = trpc.useUtils();
  const policy = trpc.handoffs.policy.useQuery();
  const connector = trpc.handoffs.connectorStatus.useQuery();
  const integration = trpc.handoffs.integration.useQuery();
  const ready = trpc.prospects.list.useQuery({ readiness: "ready", limit: 200 });
  const queue = trpc.handoffs.list.useQuery();
  const scopeTemplates = trpc.scopeTemplates.list.useQuery();
  const [minimumScore, setMinimumScore] = useState(70);
  const [destination, setDestination] = useState("SaaS de auditoría web");
  const [requireNextAction, setRequireNextAction] = useState(true);
  const [requireDigitalEvidence, setRequireDigitalEvidence] = useState(true);
  const [scopeTemplateId, setScopeTemplateId] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateSector, setTemplateSector] = useState("");
  const [templateOverview, setTemplateOverview] = useState("");
  const [templateDeliverables, setTemplateDeliverables] = useState("");
  const [templateMetrics, setTemplateMetrics] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [integrationName, setIntegrationName] = useState("SaaS de auditoría web");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [activePdfProspectId, setActivePdfProspectId] = useState<number | null>(null);

  useEffect(() => {
    if (!policy.data) return;
    setMinimumScore(policy.data.minimumOpportunityScore);
    setDestination(policy.data.destinationLabel);
    setRequireNextAction(Boolean(policy.data.requireNextAction));
    setRequireDigitalEvidence(Boolean(policy.data.requireDigitalEvidence));
  }, [policy.data]);

  useEffect(() => {
    if (!integration.data) return;
    setIntegrationName(integration.data.displayName);
    setWebhookUrl(integration.data.webhookUrl ?? "");
    setWebhookEnabled(Boolean(integration.data.isEnabled));
  }, [integration.data]);

  useEffect(() => {
    if (scopeTemplates.data?.length && (scopeTemplateId === null || !scopeTemplates.data.some(template => template.id === scopeTemplateId))) {
      setScopeTemplateId(scopeTemplates.data.find(template => template.isDefault)?.id ?? scopeTemplates.data[0].id);
    }
  }, [scopeTemplates.data, scopeTemplateId]);

  const updatePolicy = trpc.handoffs.updatePolicy.useMutation({
    onSuccess: () => { utils.handoffs.policy.invalidate(); utils.prospects.list.invalidate(); toast.success("Criterios de transición actualizados."); },
    onError: error => toast.error(error.message),
  });
  const queueProspect = trpc.handoffs.queue.useMutation({
    onSuccess: () => { utils.handoffs.list.invalidate(); utils.prospects.list.invalidate(); toast.success("Oportunidad incorporada a la revisión de auditoría."); },
    onError: error => toast.error(error.message),
  });
  const approve = trpc.handoffs.approve.useMutation({
    onSuccess: () => { utils.handoffs.list.invalidate(); toast.success("Expediente autorizado para preparación."); },
    onError: error => toast.error(error.message),
  });
  const dossier = trpc.handoffs.dossier.useMutation({
    onSuccess: result => { downloadJson(result.filename, result.dossier); utils.handoffs.list.invalidate(); toast.success("Expediente JSON preparado para revisión o entrega manual."); },
    onError: error => toast.error(error.message),
  });
  const dossierPdf = trpc.handoffs.dossierPdf.useMutation({
    onSuccess: result => { downloadPdf(result.filename, result.contentBase64); utils.handoffs.list.invalidate(); toast.success("Expediente PDF preparado para descarga y revisión humana."); },
    onError: error => toast.error(error.message),
    onSettled: () => setActivePdfProspectId(null),
  });
  const updateIntegration = trpc.handoffs.updateIntegration.useMutation({
    onSuccess: () => { utils.handoffs.integration.invalidate(); utils.handoffs.connectorStatus.invalidate(); toast.success("Configuración del SaaS guardada. El envío continúa desactivado hasta que cumpla todos los requisitos."); },
    onError: error => toast.error(error.message),
  });
  const sendToSaas = trpc.handoffs.sendToSaas.useMutation({
    onSuccess: result => { utils.handoffs.list.invalidate(); utils.handoffs.integration.invalidate(); toast.success(`Expediente entregado a ${result.destination}. Referencia: ${result.externalReference}.`); },
    onError: error => toast.error(error.message),
  });
  const createScopeTemplate = trpc.scopeTemplates.create.useMutation({
    onSuccess: created => {
      utils.scopeTemplates.list.invalidate();
      setScopeTemplateId(created.id);
      setTemplateName(""); setTemplateSector(""); setTemplateOverview(""); setTemplateDeliverables(""); setTemplateMetrics("");
      toast.success("Plantilla sectorial creada.");
    },
    onError: error => toast.error(error.message),
  });
  const updateScopeTemplate = trpc.scopeTemplates.update.useMutation({
    onSuccess: updated => {
      utils.scopeTemplates.list.invalidate();
      setScopeTemplateId(updated.id);
      setEditingTemplateId(null);
      toast.success("Plantilla sectorial actualizada.");
    },
    onError: error => toast.error(error.message),
  });
  const removeScopeTemplate = trpc.scopeTemplates.remove.useMutation({
    onSuccess: () => {
      utils.scopeTemplates.list.invalidate();
      setScopeTemplateId(null);
      setEditingTemplateId(null);
      toast.success("Plantilla sectorial eliminada.");
    },
    onError: error => toast.error(error.message),
  });

  const selectedTemplate = useMemo(() => scopeTemplates.data?.find(template => template.id === scopeTemplateId), [scopeTemplates.data, scopeTemplateId]);
  const queuedIds = new Set((queue.data ?? []).map(item => item.prospect.id));
  const savePolicy = () => updatePolicy.mutate({ minimumOpportunityScore: minimumScore, destinationLabel: destination, requireNextAction, requireDigitalEvidence });
  const saveIntegration = () => updateIntegration.mutate({ displayName: integrationName, webhookUrl: webhookUrl.trim() || null, isEnabled: webhookEnabled });
  const requestSaasDelivery = (prospectId: number, businessName: string) => {
    if (!window.confirm(`¿Entregar ahora el expediente de «${businessName}» a ${integrationName}? Se enviará al endpoint SaaS configurado y se marcará como entregado.`)) return;
    sendToSaas.mutate({ prospectId, scopeTemplateId });
  };
  const requestPdf = (prospectId: number) => {
    setActivePdfProspectId(prospectId);
    dossierPdf.mutate({ prospectId, scopeTemplateId, markExported: true });
  };
  const resetTemplateForm = () => { setTemplateName(""); setTemplateSector(""); setTemplateOverview(""); setTemplateDeliverables(""); setTemplateMetrics(""); setEditingTemplateId(null); };
  const saveTemplate = () => {
    const template = { name: templateName, sector: templateSector, overview: templateOverview, deliverables: templateDeliverables.split("\n").map(value => value.trim()).filter(Boolean), successMetrics: templateMetrics.split("\n").map(value => value.trim()).filter(Boolean) };
    if (editingTemplateId) updateScopeTemplate.mutate({ templateId: editingTemplateId, ...template });
    else createScopeTemplate.mutate(template);
  };
  const beginTemplateEdit = () => {
    if (!selectedTemplate) return;
    setTemplateName(selectedTemplate.name); setTemplateSector(selectedTemplate.sector); setTemplateOverview(selectedTemplate.overview); setTemplateDeliverables(selectedTemplate.deliverables.join("\n")); setTemplateMetrics(selectedTemplate.successMetrics.join("\n")); setEditingTemplateId(selectedTemplate.id);
    document.querySelector<HTMLDetailsElement>("#scope-template-form")?.setAttribute("open", "");
  };
  const deleteSelectedTemplate = () => {
    if (!selectedTemplate || !window.confirm(`¿Eliminar la plantilla «${selectedTemplate.name}»? Esta acción no se puede deshacer.`)) return;
    removeScopeTemplate.mutate({ templateId: selectedTemplate.id });
  };

  return <DashboardLayout>
    <PageHeader
      eyebrow="Fase 2 · Auditoría web"
      title="Transición a auditoría"
      description="Revisa oportunidades aptas, aprueba un expediente con alcance recomendado y entrégalo manualmente al SaaS que construirá o mejorará el sitio. Ningún dato sale de Nexo sin una acción explícita."
      actions={<Link href="/app/guia"><Button variant="outline"><BookOpenCheck size={16} />Guía de operación</Button></Link>}
    />

    <section className="mb-6 grid gap-4 rounded-3xl border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-indigo-50 p-5 lg:grid-cols-[auto_1fr_auto] lg:items-center">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><FileCheck2 size={21} /></span>
      <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Expediente de auditoría 2.0</p><h2 className="mt-1 font-bold text-slate-950">Una base concreta para crear o mejorar un sitio web</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Incluye la recomendación de servicio, señales de oportunidad, agenda de auditoría, alcance sectorial y checklist para el SaaS receptor. No crea propuestas ni sitios automáticamente.</p></div>
      <Link href="/app/guia" className="text-sm font-bold text-primary hover:underline">Ver recorrido</Link>
    </section>

    <div className="grid gap-5 xl:grid-cols-[1.12fr_.88fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">Criterios de aptitud</h2><p className="mt-1 text-sm text-slate-600">La regla combina score, seguimiento comercial y evidencia digital verificable.</p></div><Settings2 className="text-primary" size={20} /></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Score mínimo<Input className="mt-1" type="number" min="0" max="100" value={minimumScore} onChange={event => setMinimumScore(Number(event.target.value))} /></label><label className="text-sm font-semibold text-slate-700">Destino previsto<Input className="mt-1" value={destination} onChange={event => setDestination(event.target.value)} /></label></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2"><label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={requireNextAction} onChange={event => setRequireNextAction(event.target.checked)} /><span><strong className="block">Exigir próxima acción</strong>La oportunidad necesita una acción comercial registrada.</span></label><label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={requireDigitalEvidence} onChange={event => setRequireDigitalEvidence(event.target.checked)} /><span><strong className="block">Exigir evidencia digital</strong>Debe no tener sitio o contar con una evaluación web disponible.</span></label></div>
        <Button className="mt-5" disabled={updatePolicy.isPending} onClick={savePolicy}>Guardar criterios</Button>
      </section>
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm"><div className="flex gap-3"><LockKeyhole className="mt-0.5 text-amber-700" size={20} /><div><h2 className="font-bold text-amber-950">Entrega externa protegida</h2><p className="mt-1 text-sm leading-6 text-amber-900">El conector está {connector.data?.state === "activo" ? "activo" : connector.data?.state === "pendiente_de_activacion" ? "configurado pero pendiente de activación" : "en modo placeholder"}. La entrega solo ocurre después de tu confirmación explícita en cada expediente.</p></div></div></section>
    </div>

    <section className="mt-6 rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-violet-50 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-700 text-white"><Webhook size={19} /></span><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-700">Integración SaaS</p><h2 className="mt-1 font-bold text-slate-950">Destino del webhook de auditoría</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">El endpoint se guarda por cuenta; el secreto de firma permanece únicamente en la configuración segura del servidor.</p></div></div><span className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${connector.data?.state === "activo" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}><ShieldCheck size={14} />{connector.data?.state === "activo" ? "Listo para entrega manual" : "Sin envío automático"}</span></div>
      <div className="mt-5 grid gap-3 md:grid-cols-[.8fr_1.2fr]"><label className="text-sm font-semibold text-slate-700">Nombre del SaaS<Input className="mt-1 bg-white" value={integrationName} onChange={event => setIntegrationName(event.target.value)} placeholder="Ej.: Auditoría Web Pro" /></label><label className="text-sm font-semibold text-slate-700">URL pública HTTPS del webhook<Input className="mt-1 bg-white" type="url" value={webhookUrl} onChange={event => setWebhookUrl(event.target.value)} placeholder="https://tu-saas.example.com/webhooks/nexo" /></label></div>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-sky-100 bg-white/80 p-3 text-sm text-slate-700"><input className="mt-1" type="checkbox" checked={webhookEnabled} onChange={event => setWebhookEnabled(event.target.checked)} /><span><strong className="block">Habilitar entregas mediante webhook</strong>Solo se permitirá cuando la URL sea HTTPS pública y el proyecto tenga definido el secreto de firma <code>NEXO_HANDOFF_WEBHOOK_SECRET</code>. Guardar esta configuración no realiza ningún envío.</span></label>
      <div className="mt-4 flex flex-col gap-3 border-t border-sky-100 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-slate-500">{integration.data?.hasSigningSecret ? "El secreto de firma está disponible en el servidor." : "Falta añadir el secreto de firma antes de activar el envío."}{integration.data?.lastDeliveryStatus === "failed" && integration.data.lastDeliveryError ? ` Último intento: ${integration.data.lastDeliveryError}` : ""}</p><Button disabled={updateIntegration.isPending} onClick={saveIntegration}><Save size={16} />Guardar integración</Button></div>
    </section>

    <section className="mt-6 rounded-3xl border border-indigo-200 bg-indigo-50/50 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-700">Alcance web por sector</p>
      <h2 className="mt-1 text-xl font-bold text-slate-950">Personaliza lo que recibirá el SaaS</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">Selecciona una plantilla para los expedientes JSON o PDF. Las predeterminadas se crean en tu cuenta y puedes añadir las tuyas.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <label className="min-w-0 text-sm font-semibold text-slate-700">Plantilla activa<select aria-label="Plantilla de alcance sectorial" className="mt-1 h-10 min-w-0 w-full rounded-md border border-input bg-white px-3 text-sm" value={scopeTemplateId ?? ""} onChange={event => setScopeTemplateId(Number(event.target.value) || null)}>{scopeTemplates.data?.map(template => <option key={template.id} value={template.id}>{template.name} · {template.sector}</option>)}</select></label>
        <div className="min-w-0 rounded-xl border border-indigo-100 bg-white px-4 py-3 text-sm text-slate-600"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block break-words text-slate-900">{selectedTemplate?.name ?? "Sin plantilla"}</strong>{selectedTemplate && <span className="mt-0.5 block text-xs font-semibold text-indigo-700">{selectedTemplate.sector}</span>}<span className="mt-1 block">{selectedTemplate?.overview ?? "Carga una plantilla para personalizar el alcance."}</span></div>{selectedTemplate && <div className="flex shrink-0 gap-1"><Button type="button" size="icon" variant="ghost" aria-label="Editar plantilla seleccionada" onClick={beginTemplateEdit}><Pencil size={15} /></Button><Button type="button" size="icon" variant="ghost" className="text-rose-700 hover:bg-rose-50 hover:text-rose-800" aria-label="Eliminar plantilla seleccionada" disabled={removeScopeTemplate.isPending} onClick={deleteSelectedTemplate}><Trash2 size={15} /></Button></div>}</div></div>
      </div>
      <details id="scope-template-form" className="mt-4 rounded-2xl border border-indigo-100 bg-white p-4"><summary className="cursor-pointer text-sm font-bold text-indigo-800">{editingTemplateId ? "Editar plantilla sectorial" : "Crear una plantilla sectorial propia"}</summary><div className="mt-4 grid gap-3 sm:grid-cols-2"><Input placeholder="Nombre de plantilla" value={templateName} onChange={event => setTemplateName(event.target.value)} /><Input placeholder="Sector" value={templateSector} onChange={event => setTemplateSector(event.target.value)} /></div><Textarea className="mt-3" placeholder="Resumen del alcance recomendado" value={templateOverview} onChange={event => setTemplateOverview(event.target.value)} /><div className="mt-3 grid gap-3 sm:grid-cols-2"><Textarea placeholder="Entregables (uno por línea)" value={templateDeliverables} onChange={event => setTemplateDeliverables(event.target.value)} /><Textarea placeholder="Métricas de éxito (una por línea)" value={templateMetrics} onChange={event => setTemplateMetrics(event.target.value)} /></div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" disabled={createScopeTemplate.isPending || updateScopeTemplate.isPending} onClick={saveTemplate}>{editingTemplateId ? "Actualizar plantilla" : "Guardar plantilla"}</Button>{editingTemplateId && <Button size="sm" variant="outline" onClick={resetTemplateForm}>Cancelar edición</Button>}</div></details>
    </section>

    <section className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50/50 p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Aptas para revisar</p><h2 className="mt-1 text-xl font-bold">{ready.data?.length ?? 0} oportunidades cumplen los criterios</h2></div><Waypoints className="text-emerald-700" size={25} /></div><div className="mt-4 space-y-3">{ready.data?.length ? ready.data.map(item => <div key={item.prospect.id} className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div><Link href={`/app/prospectos/${item.prospect.id}`}><strong className="hover:text-primary">{item.business.name}</strong></Link><p className="mt-1 text-sm text-slate-600">Score {item.prospect.opportunityScore}/100 · {item.business.websiteStatus === "no_website" ? "sin sitio" : "análisis web disponible"} · próxima acción: {item.prospect.nextActionLabel}</p></div>{queuedIds.has(item.prospect.id) ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16} />En cola</span> : <Button size="sm" onClick={() => queueProspect.mutate({ prospectId: item.prospect.id })}>Preparar auditoría</Button>}</div>) : <p className="rounded-2xl bg-white p-4 text-sm text-slate-600">Aún no hay oportunidades aptas. Ajusta criterios o completa el seguimiento de los prospectos cualificados.</p>}</div></section>

    <section className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">Cola de expedientes</h2><p className="mt-1 text-sm text-slate-600">Descarga un PDF preparado para revisión, o entrega al SaaS solo si el webhook está listo.</p></div><span className="inline-flex w-fit items-center gap-1 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800"><FileDown size={14} />Alcance: {selectedTemplate?.name ?? "predeterminado"}</span></div>{queue.data?.length ? <div className="divide-y divide-slate-100">{queue.data.map(item => <div key={item.handoff.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2"><Link href={`/app/prospectos/${item.prospect.id}`}><strong className="hover:text-primary">{item.business.name}</strong></Link><PriorityPill priority={item.prospect.priority} /></div><p className="mt-1 text-sm text-slate-600">{item.handoff.destinationLabel} · estado: <strong>{item.handoff.status.replaceAll("_", " ")}</strong></p>{["approved", "package_exported"].includes(item.handoff.status) && <p className="mt-2 text-xs text-slate-500">El PDF incluye ficha, score, recomendación, alcance sectorial y límites operativos.</p>}</div><div className="flex flex-wrap gap-2">{item.handoff.status === "ready_for_review" && <Button size="sm" variant="outline" onClick={() => approve.mutate({ prospectId: item.prospect.id })}>Aprobar</Button>}{["approved", "package_exported"].includes(item.handoff.status) && <><Button size="sm" variant="outline" onClick={() => dossier.mutate({ prospectId: item.prospect.id, scopeTemplateId, markExported: true })}><Download size={15} />JSON</Button><Button size="sm" disabled={dossierPdf.isPending} onClick={() => requestPdf(item.prospect.id)}>{activePdfProspectId === item.prospect.id ? <span className="animate-pulse">Preparando PDF…</span> : <><FileDown size={15} />Descargar PDF</>}</Button>{connector.data?.state === "activo" && <Button size="sm" variant="secondary" disabled={sendToSaas.isPending} onClick={() => requestSaasDelivery(item.prospect.id, item.business.name)}><Send size={15} />Entregar al SaaS</Button>}</>}<Link href={`/app/prospectos/${item.prospect.id}`} className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5"><ExternalLink size={15} />Ficha</Link></div></div>)}</div> : <EmptyState title="Aún no hay expedientes" description="Cuando apruebes una oportunidad apta, su expediente aparecerá aquí para revisión y entrega manual." href="/app/prospectos" action="Ver oportunidades" />}</section>
  </DashboardLayout>;
}
