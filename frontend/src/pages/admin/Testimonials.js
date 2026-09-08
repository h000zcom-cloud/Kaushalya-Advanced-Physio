import { useState } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, PageHeader, DemoBadge } from "@/components/shared/Primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/States";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useAdminMutation, useAdminQuery } from "@/features/admin/hooks";
import { useAuth } from "@/features/auth/AuthContext";
import { api } from "@/lib/api";
import { todayIso } from "@/lib/format";
import { useSeo } from "@/lib/seo";
import { cn } from "@/lib/utils";

const EMPTY = { patient_name: "", display_mode: "initials", content: "", service_id: null, condition_key: "", rating: 5, date: todayIso(), is_featured: false, is_published: false, is_demo: false, consent_confirmed: false };

export default function Testimonials() {
  const { data, isLoading, isError, refetch } = useAdminQuery("testimonials", "/admin/testimonials");
  const { data: services } = useAdminQuery("services", "/admin/services");
  const { can } = useAuth();
  const [edit, setEdit] = useState(null);
  const [remove, setRemove] = useState(null);
  const save = useAdminMutation((body) => (body.id ? api.put(`/admin/testimonials/${body.id}`, body) : api.post("/admin/testimonials", body)), { success: "Testimonial saved", onSuccess: () => setEdit(null) });
  const del = useAdminMutation((id) => api.delete(`/admin/testimonials/${id}`), { success: "Testimonial deleted", onSuccess: () => setRemove(null) });
  useSeo({ title: "Testimonials · Dashboard", noindex: true });
  const set = (k, v) => setEdit((f) => ({ ...f, [k]: v }));
  const canWrite = can(["OWNER", "ADMIN"]);
  return (
    <div data-testid="admin-testimonials">
      <PageHeader title="Testimonials" description="Only publish stories the patient has approved. Demo entries should be replaced before launch." actions={canWrite && <Button size="sm" onClick={() => setEdit(EMPTY)} className="bg-brand hover:bg-brand-hover" data-testid="testimonials-add"><Plus className="h-4 w-4" /> Add testimonial</Button>} />
      {isLoading && <LoadingState rows={4} />}
      {isError && <ErrorState onRetry={refetch} />}
      {data && (data.items.length === 0 ? <EmptyState title="No testimonials" text="Add approved patient stories to show on the website." /> : (
        <ul className="grid gap-3 md:grid-cols-2" data-testid="testimonials-list">{data.items.map((t) => (
          <li key={t.id} className={cn("rounded-xl border border-border bg-white p-4", !t.is_published && "opacity-70")}>
            <div className="flex items-start justify-between gap-2"><div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-admin font-semibold">{t.patient_name}</span><span className="text-xs text-muted-foreground">({t.display_mode})</span>{t.is_featured && <Star className="h-3.5 w-3.5 fill-clay text-clay" />}{t.is_demo && <DemoBadge />}<span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", t.is_published ? "bg-[#ECFDF5] text-[#047857]" : "bg-muted text-muted-foreground")}>{t.is_published ? "Published" : "Draft"}</span></div>{canWrite && <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setEdit({ ...EMPTY, ...t })} data-testid={`testimonial-edit-${t.id}`}>Edit</Button><Button size="sm" variant="ghost" onClick={() => setRemove(t.id)} aria-label="Delete" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></div>}</div>
            <p className="mt-2 text-sm text-muted-foreground">“{t.content}”</p>
            <p className="mt-2 text-xs text-muted-foreground">{t.date}{t.rating ? ` · ${t.rating}/5` : ""}</p>
          </li>
        ))}</ul>
      ))}
      <Dialog open={!!edit} onOpenChange={() => setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" data-testid="testimonial-dialog">
          <DialogHeader><DialogTitle className="font-admin">{edit?.id ? "Edit testimonial" : "New testimonial"}</DialogTitle></DialogHeader>
          {edit && <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Patient name" htmlFor="t-name" required><Input id="t-name" value={edit.patient_name} onChange={(e) => set("patient_name", e.target.value)} data-testid="testimonial-name-input" /></Field>
            <Field label="Display as" htmlFor="t-mode"><Select value={edit.display_mode} onValueChange={(v) => set("display_mode", v)}><SelectTrigger id="t-mode"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="full">Full name</SelectItem><SelectItem value="initials">Initials</SelectItem><SelectItem value="anonymous">Anonymous</SelectItem></SelectContent></Select></Field>
            <Field label="Story" htmlFor="t-content" required className="sm:col-span-2"><Textarea id="t-content" rows={4} value={edit.content} onChange={(e) => set("content", e.target.value)} data-testid="testimonial-content-input" /></Field>
            <Field label="Related service" htmlFor="t-service"><Select value={edit.service_id || "none"} onValueChange={(v) => set("service_id", v === "none" ? null : v)}><SelectTrigger id="t-service"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{(services?.items || []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Date" htmlFor="t-date"><Input id="t-date" type="date" value={edit.date} onChange={(e) => set("date", e.target.value)} /></Field>
            <Field label="Rating (1–5)" htmlFor="t-rating"><Input id="t-rating" type="number" min={1} max={5} value={edit.rating ?? ""} onChange={(e) => set("rating", e.target.value ? Number(e.target.value) : null)} /></Field>
            <div className="flex flex-col gap-2 text-sm sm:col-span-2">
              <label className="flex items-center gap-2"><Switch checked={edit.is_featured} onCheckedChange={(v) => set("is_featured", v)} /> Featured on homepage</label>
              <label className="flex items-center gap-2"><Switch checked={edit.is_published} onCheckedChange={(v) => set("is_published", v)} data-testid="testimonial-published-switch" /> Published on website</label>
              <label className="flex items-center gap-2"><Switch checked={edit.consent_confirmed} onCheckedChange={(v) => set("consent_confirmed", v)} data-testid="testimonial-consent-switch" /> Patient has approved publishing this story</label>
              <label className="flex items-center gap-2"><Switch checked={edit.is_demo} onCheckedChange={(v) => set("is_demo", v)} /> Demo / sample content</label>
            </div>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={() => save.mutate(edit)} disabled={save.isPending || !edit?.patient_name || (edit?.content || "").length < 10} className="bg-brand hover:bg-brand-hover" data-testid="testimonial-save">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!remove} onOpenChange={() => setRemove(null)} title="Delete testimonial?" description="This removes it from the website immediately." confirmLabel="Delete" destructive onConfirm={() => del.mutate(remove)} loading={del.isPending} />
    </div>
  );
}
