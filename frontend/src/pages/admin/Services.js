import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, PageHeader } from "@/components/shared/Primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/States";
import { useAdminMutation, useAdminQuery } from "@/features/admin/hooks";
import { useAuth } from "@/features/auth/AuthContext";
import { api } from "@/lib/api";
import { useSeo } from "@/lib/seo";
import { cn } from "@/lib/utils";

const EMPTY = { name: "", short_description: "", category: "General", condition_keys: [], hero_image_url: "", overview: "", symptoms: [], who_benefits: [], how_it_helps: "", approach: [], what_to_expect: "", faqs: [], duration_minutes: 60, acceptance_mode: "INHERIT", is_active: true, is_demo: false, display_order: 0 };
const lines = (arr) => (arr || []).join("\n");
const fromLines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const faqLines = (faqs) => (faqs || []).map((f) => `${f.question} | ${f.answer}`).join("\n");
const faqFromLines = (s) => fromLines(s).map((l) => { const [q, ...a] = l.split("|"); return { question: q.trim(), answer: a.join("|").trim() }; }).filter((f) => f.question && f.answer);

export default function Services() {
  const { data, isLoading, isError, refetch } = useAdminQuery("services", "/admin/services");
  const { data: clinic } = useAdminQuery("settings", "/admin/settings", undefined, { retry: false });
  const { can } = useAuth();
  const [edit, setEdit] = useState(null);
  const toggle = useAdminMutation(({ id, is_active }) => api.patch(`/admin/services/${id}/status`, { is_active }), { success: "Service status updated" });
  const save = useAdminMutation((body) => (body.id ? api.put(`/admin/services/${body.id}`, body) : api.post("/admin/services", body)), { success: "Service saved", onSuccess: () => setEdit(null) });
  useSeo({ title: "Services · Dashboard", noindex: true });
  const conditions = clinic?.content?.conditions || [];
  const set = (k, v) => setEdit((f) => ({ ...f, [k]: v }));

  return (
    <div data-testid="admin-services">
      <PageHeader title="Services" description="Public service pages and the booking options patients choose from." actions={can(["OWNER", "ADMIN"]) && <Button size="sm" onClick={() => setEdit(EMPTY)} className="bg-brand hover:bg-brand-hover" data-testid="services-add"><Plus className="h-4 w-4" /> Add service</Button>} />
      {isLoading && <LoadingState rows={6} />}
      {isError && <ErrorState onRetry={refetch} />}
      {data && (data.items.length === 0 ? <EmptyState title="No services yet" /> : (
        <div className="overflow-x-auto rounded-xl border border-border bg-white"><table className="admin-table w-full min-w-[720px]" data-testid="services-table"><thead className="border-b border-border bg-muted/50"><tr><th>Service</th><th>Category</th><th>Doctors</th><th>Acceptance</th><th>Slug</th><th>Active</th></tr></thead><tbody className="divide-y divide-border">
          {data.items.map((s) => <tr key={s.id} className={cn(!s.is_active && "opacity-60")} data-testid={`service-row-${s.slug}`}><td><button type="button" onClick={() => setEdit({ ...EMPTY, ...s })} className="text-left font-medium hover:text-brand" data-testid={`service-edit-${s.slug}`}>{s.name}</button><p className="max-w-md truncate text-xs text-muted-foreground">{s.short_description}</p></td><td>{s.category}</td><td>{s.eligible_doctor_count}</td><td className="text-xs">{s.acceptance_mode === "INHERIT" ? "Clinic default" : s.acceptance_mode}</td><td className="font-mono text-xs text-muted-foreground">/services/{s.slug}</td><td>{can(["OWNER", "ADMIN"]) && <Switch checked={s.is_active} onCheckedChange={(v) => toggle.mutate({ id: s.id, is_active: v })} aria-label={`Toggle ${s.name}`} data-testid={`service-toggle-${s.slug}`} />}</td></tr>)}
        </tbody></table></div>
      ))}
      <Dialog open={!!edit} onOpenChange={() => setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl" data-testid="service-dialog">
          <DialogHeader><DialogTitle className="font-admin">{edit?.id ? "Edit service" : "New service"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="s-name" required><Input id="s-name" value={edit.name} onChange={(e) => set("name", e.target.value)} data-testid="service-name-input" /></Field>
              <Field label="Category" htmlFor="s-cat"><Input id="s-cat" value={edit.category} onChange={(e) => set("category", e.target.value)} /></Field>
              <Field label="Short description" htmlFor="s-short" className="sm:col-span-2"><Input id="s-short" value={edit.short_description} onChange={(e) => set("short_description", e.target.value)} /></Field>
              <Field label="Booking acceptance" htmlFor="s-mode" hint="Used when clinic mode is 'Per service'."><Select value={edit.acceptance_mode} onValueChange={(v) => set("acceptance_mode", v)}><SelectTrigger id="s-mode"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INHERIT">Clinic default</SelectItem><SelectItem value="AUTO">Auto-confirm</SelectItem><SelectItem value="MANUAL">Manual confirmation</SelectItem></SelectContent></Select></Field>
              <Field label="Hero image URL" htmlFor="s-img"><Input id="s-img" value={edit.hero_image_url} onChange={(e) => set("hero_image_url", e.target.value)} /></Field>
              <div className="sm:col-span-2"><p className="mb-1.5 text-sm font-medium">Linked conditions</p><div className="flex flex-wrap gap-2">{conditions.map((c) => <label key={c.key} className={cn("cursor-pointer rounded-full border px-3 py-1 text-xs", edit.condition_keys.includes(c.key) ? "border-brand bg-brand text-white" : "border-border")}><input type="checkbox" className="sr-only" checked={edit.condition_keys.includes(c.key)} onChange={(e) => set("condition_keys", e.target.checked ? [...edit.condition_keys, c.key] : edit.condition_keys.filter((k) => k !== c.key))} />{c.label}</label>)}</div></div>
              <Field label="Overview" htmlFor="s-over" className="sm:col-span-2"><Textarea id="s-over" rows={3} value={edit.overview} onChange={(e) => set("overview", e.target.value)} /></Field>
              <Field label="Symptoms (one per line)" htmlFor="s-sym"><Textarea id="s-sym" rows={4} value={lines(edit.symptoms)} onChange={(e) => set("symptoms", fromLines(e.target.value))} /></Field>
              <Field label="Who may benefit (one per line)" htmlFor="s-who"><Textarea id="s-who" rows={4} value={lines(edit.who_benefits)} onChange={(e) => set("who_benefits", fromLines(e.target.value))} /></Field>
              <Field label="How physiotherapy can help" htmlFor="s-how" className="sm:col-span-2"><Textarea id="s-how" rows={3} value={edit.how_it_helps} onChange={(e) => set("how_it_helps", e.target.value)} /></Field>
              <Field label="Approach steps (one per line)" htmlFor="s-app"><Textarea id="s-app" rows={4} value={lines(edit.approach)} onChange={(e) => set("approach", fromLines(e.target.value))} /></Field>
              <Field label="What to expect" htmlFor="s-exp"><Textarea id="s-exp" rows={4} value={edit.what_to_expect} onChange={(e) => set("what_to_expect", e.target.value)} /></Field>
              <Field label="FAQs (one per line: question | answer)" htmlFor="s-faq" className="sm:col-span-2"><Textarea id="s-faq" rows={3} value={faqLines(edit.faqs)} onChange={(e) => set("faqs", faqFromLines(e.target.value))} /></Field>
              <Field label="Display order" htmlFor="s-order"><Input id="s-order" type="number" value={edit.display_order} onChange={(e) => set("display_order", Number(e.target.value))} /></Field>
              <div className="flex items-end gap-6 text-sm"><label className="flex items-center gap-2"><Switch checked={edit.is_active} onCheckedChange={(v) => set("is_active", v)} /> Active</label></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={() => save.mutate(edit)} disabled={!edit?.name || save.isPending} className="bg-brand hover:bg-brand-hover" data-testid="service-save">{save.isPending ? "Saving..." : "Save service"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
