"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ItemEditor } from "@/components/ItemEditor";
import { Button, Card, ErrorBanner, PageHeader, Sheet, Spinner, useBlobUrl } from "@/components/ui";
import { processMultiPhoto, processSinglePhoto, saveDraft, type Draft, type Status } from "@/lib/pipeline";

type Job = { key: string; file: File; status: Status | null; error?: string; drafts: Draft[] };

export default function AddItemPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [editing, setEditing] = useState<{ job: string; draft: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const update = (key: string, patch: Partial<Job>) => setJobs((js) => js.map((j) => (j.key === key ? { ...j, ...patch } : j)));

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files).slice(0, 12);
    const newJobs: Job[] = list.map((f) => ({ key: crypto.randomUUID(), file: f, status: { stage: "resize", label: "Queued…" }, drafts: [] }));
    setJobs((js) => [...js, ...newJobs]);
    // process sequentially to keep memory sane on phones
    for (const j of newJobs) {
      try {
        const drafts =
          mode === "single"
            ? [await processSinglePhoto(j.file, (s) => update(j.key, { status: s }))]
            : await processMultiPhoto(j.file, (s) => update(j.key, { status: s }));
        update(j.key, { drafts, status: { stage: "done", label: "Ready" } });
      } catch (e) {
        update(j.key, { error: (e as Error).message, status: null });
      }
    }
  };

  const drafts = jobs.flatMap((j) => j.drafts.map((d) => ({ job: j.key, draft: d })));
  const ready = drafts.length > 0 && jobs.every((j) => j.status?.stage === "done" || j.error);

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const { draft } of drafts) await saveDraft(draft, mode === "single" ? "photo" : "selfie");
      router.replace("/closet");
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const editingDraft = editing ? jobs.find((j) => j.key === editing.job)?.drafts.find((d) => d.key === editing.draft) : null;

  return (
    <div>
      <PageHeader title="Add to closet" back="/closet" />
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFiles(e.target.files)} />

      <div className="px-4 pt-4">
        <div className="grid grid-cols-2 bg-card rounded-full p-1 mb-4">
          <button onClick={() => setMode("single")} className={`py-2 rounded-full text-sm font-medium ${mode === "single" ? "bg-paper text-ink" : "text-muted"}`}>
            One item per photo
          </button>
          <button onClick={() => setMode("multi")} className={`py-2 rounded-full text-sm font-medium ${mode === "multi" ? "bg-paper text-ink" : "text-muted"}`}>
            Outfit / flat-lay
          </button>
        </div>
        <p className="text-sm text-muted mb-4">
          {mode === "single"
            ? "Lay each piece flat or hang it against a plain background. Pick several photos at once."
            : "Upload a mirror selfie or a flat-lay with several pieces — each one is detected, cut out and tagged."}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="ghost" size="lg" onClick={() => camRef.current?.click()}>📷 Camera</Button>
          <Button variant="ghost" size="lg" onClick={() => fileRef.current?.click()}>🖼️ Photos</Button>
        </div>
      </div>

      <ErrorBanner error={error} />

      <div className="px-4 mt-5 space-y-3">
        {jobs.map((j) => (
          <JobCard key={j.key} job={j} onEdit={(draftKey) => setEditing({ job: j.key, draft: draftKey })} onRemoveDraft={(k) => update(j.key, { drafts: j.drafts.filter((d) => d.key !== k) })} onRemove={() => setJobs((js) => js.filter((x) => x.key !== j.key))} />
        ))}
      </div>

      {drafts.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] bg-gradient-to-t from-ink via-ink to-transparent">
          <div className="max-w-md mx-auto">
            <Button size="lg" onClick={saveAll} loading={saving} disabled={!ready}>
              {ready ? `Save ${drafts.length} item${drafts.length > 1 ? "s" : ""} to closet` : "Processing…"}
            </Button>
          </div>
        </div>
      )}

      <Sheet open={!!editingDraft} onClose={() => setEditing(null)} title="Edit details">
        {editingDraft && (
          <>
            <ItemEditor
              value={editingDraft.tags}
              onChange={(tags) =>
                setJobs((js) => js.map((j) => (j.key === editing!.job ? { ...j, drafts: j.drafts.map((d) => (d.key === editing!.draft ? { ...d, tags } : d)) } : j)))
              }
            />
            <Button size="lg" onClick={() => setEditing(null)}>Done</Button>
          </>
        )}
      </Sheet>
    </div>
  );
}

function JobCard({ job, onEdit, onRemove, onRemoveDraft }: { job: Job; onEdit: (draftKey: string) => void; onRemove: () => void; onRemoveDraft: (k: string) => void }) {
  const srcUrl = useBlobUrl(job.file);
  if (job.error) {
    return (
      <Card className="p-3 flex items-center gap-3">
        {srcUrl && <img src={srcUrl} alt="" className="w-14 h-14 rounded-xl object-cover" />}
        <div className="flex-1 min-w-0 text-sm text-red-300 break-words">{job.error}</div>
        <button onClick={onRemove} className="text-muted">✕</button>
      </Card>
    );
  }
  if (!job.drafts.length) {
    return (
      <Card className="p-3 flex items-center gap-3">
        {srcUrl && <img src={srcUrl} alt="" className="w-14 h-14 rounded-xl object-cover" />}
        <div className="flex-1">
          <div className="text-sm">{job.status?.label}</div>
          {job.status?.pct != null && (
            <div className="h-1 bg-line rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-accent transition-all" style={{ width: `${job.status.pct}%` }} />
            </div>
          )}
        </div>
        <Spinner />
      </Card>
    );
  }
  return (
    <>
      {job.drafts.map((d) => (
        <DraftCard key={d.key} draft={d} onEdit={() => onEdit(d.key)} onRemove={() => onRemoveDraft(d.key)} />
      ))}
    </>
  );
}

function DraftCard({ draft, onEdit, onRemove }: { draft: Draft; onEdit: () => void; onRemove: () => void }) {
  const url = useBlobUrl(draft.image);
  return (
    <Card className="p-3 flex items-center gap-3">
      <div className="w-20 h-20 rounded-xl bg-paper overflow-hidden shrink-0">{url && <img src={url} alt="" className="w-full h-full object-contain p-1" />}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{draft.tags.name}</p>
        <p className="text-xs text-muted truncate">
          {draft.tags.category} · {draft.tags.colors.slice(0, 3).join(", ")} · {draft.tags.material}
        </p>
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          {draft.tags.styleTags.slice(0, 3).map((t) => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-line text-paper/80">{t}</span>
          ))}
          {!draft.bgRemoved && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-200">original bg</span>}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <button onClick={onEdit} className="text-xs underline text-paper/80">Edit</button>
        <button onClick={onRemove} className="text-xs text-muted">Remove</button>
      </div>
    </Card>
  );
}
