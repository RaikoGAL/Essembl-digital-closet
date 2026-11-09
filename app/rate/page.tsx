"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Card, ErrorBanner, PageHeader, ScoreRing, inputCls, useBlobUrl } from "@/components/ui";
import { ai } from "@/lib/ai-client";
import { blobToDataUrl, resizeBlob } from "@/lib/images";
import { processMultiPhoto, saveDraft, type Draft } from "@/lib/pipeline";
import type { RateResult } from "@/lib/types";

export default function RatePage() {
  const router = useRouter();
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [occasion, setOccasion] = useState("");
  const [result, setResult] = useState<RateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<{ score: number; headline: string; at: number }[]>([]);
  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem("rate-history") || "[]");
      if (Array.isArray(h)) setHistory(h.filter((x) => x && typeof x.score === "number"));
    } catch {
      /* ignore */
    }
  }, []);
  const url = useBlobUrl(photo);

  const pick = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setResult(null);
    setDrafts(null);
    setError(null);
    setPhoto(await resizeBlob(f, 1280, "image/jpeg", 0.85));
  };

  const rate = async () => {
    if (!photo) return;
    setLoading(true);
    setError(null);
    try {
      const r = await ai.rateImage(await blobToDataUrl(photo), occasion || undefined);
      setResult(r);
      const h = [{ score: r.score, headline: r.headline, at: Date.now() }, ...history].slice(0, 20);
      setHistory(h);
      try {
        localStorage.setItem("rate-history", JSON.stringify(h));
      } catch {
        /* ignore */
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const extract = async () => {
    if (!photo) return;
    setError(null);
    try {
      const d = await processMultiPhoto(photo, (s) => setExtracting(s.label));
      setDrafts(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExtracting(null);
    }
  };

  const saveDrafts = async () => {
    if (!drafts) return;
    setSaving(true);
    for (const d of drafts) await saveDraft(d, "selfie");
    setSaving(false);
    router.push("/closet");
  };

  return (
    <div>
      <PageHeader title="Rate my look" subtitle="Snap today's outfit for an honest score and tips" />
      <input ref={camRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => pick(e.target.files)} />
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files)} />

      <div className="px-4 pt-4">
        {url ? (
          <div className="relative rounded-3xl overflow-hidden bg-card">
            <img src={url} alt="Your look" className="w-full max-h-[60vh] object-contain" />
            <button onClick={() => { setPhoto(null); setResult(null); setDrafts(null); }} className="absolute top-3 right-3 bg-ink/70 rounded-full w-9 h-9">✕</button>
          </div>
        ) : (
          <Card className="p-8 text-center">
            <div className="text-5xl mb-3">🤳</div>
            <h3 className="font-semibold">Mirror selfie or full-body photo</h3>
            <p className="text-sm text-muted mt-1">Good light, whole outfit visible. You&apos;ll get a score, what works, and what to tweak.</p>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <Button variant="ghost" size="lg" onClick={() => camRef.current?.click()}>📷 Camera</Button>
              <Button variant="ghost" size="lg" onClick={() => fileRef.current?.click()}>🖼️ Photos</Button>
            </div>
          </Card>
        )}
      </div>

      {photo && !result && (
        <div className="px-4 mt-4">
          <input className={inputCls} placeholder="Occasion? (optional) e.g. first date, client meeting" value={occasion} onChange={(e) => setOccasion(e.target.value)} />
          <Button size="lg" className="mt-3" onClick={rate} loading={loading}>Rate this look</Button>
        </div>
      )}

      <ErrorBanner error={error} />

      {result && (
        <div className="px-4 mt-4 space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-4">
              <ScoreRing score={result.score} size={96} label="/100" />
              <p className="flex-1 font-semibold text-lg leading-snug">{result.headline}</p>
            </div>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-muted mb-1.5">What works</p>
              <ul className="space-y-1.5 text-sm">
                {result.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2"><span>✅</span><span>{s}</span></li>
                ))}
              </ul>
            </div>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-muted mb-1.5">Level it up</p>
              <ul className="space-y-1.5 text-sm">
                {result.improvements.map((s, i) => (
                  <li key={i} className="flex gap-2"><span>💡</span><span>{s}</span></li>
                ))}
              </ul>
            </div>
          </Card>

          <Card className="p-4">
            <h4 className="font-semibold">Add what you&apos;re wearing to your closet</h4>
            <p className="text-sm text-muted mt-1">Each piece gets detected, cut out and tagged.</p>
            {!drafts ? (
              <Button variant="ghost" className="mt-3 w-full" onClick={extract} loading={!!extracting}>
                {extracting ?? "Detect items"}
              </Button>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {drafts.map((d) => (
                    <DraftThumb key={d.key} draft={d} onRemove={() => setDrafts(drafts.filter((x) => x.key !== d.key))} />
                  ))}
                </div>
                {drafts.length === 0 ? (
                  <p className="text-sm text-muted mt-3">Nothing left to save.</p>
                ) : (
                  <Button className="mt-3 w-full" onClick={saveDrafts} loading={saving}>Save {drafts.length} item{drafts.length > 1 ? "s" : ""}</Button>
                )}
              </>
            )}
          </Card>

          <Button variant="ghost" size="lg" onClick={() => { setPhoto(null); setResult(null); setDrafts(null); }}>Rate another look</Button>
        </div>
      )}

      {history.length > 0 && !result && (
        <div className="px-4 mt-8">
          <p className="text-sm font-semibold mb-2">Recent scores</p>
          <div className="space-y-2">
            {history.slice(0, 5).map((h, i) => (
              <Card key={i} className="p-3 flex items-center gap-3">
                <ScoreRing score={h.score} size={44} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{h.headline}</p>
                  <p className="text-xs text-muted">{new Date(h.at).toLocaleDateString()}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DraftThumb({ draft, onRemove }: { draft: Draft; onRemove: () => void }) {
  const u = useBlobUrl(draft.image);
  return (
    <div className="relative">
      <div className="aspect-square rounded-xl bg-paper overflow-hidden">{u && <img src={u} alt="" className="w-full h-full object-contain p-1" />}</div>
      <p className="text-[10px] mt-1 truncate text-center">{draft.tags.name}</p>
      <button onClick={onRemove} className="absolute -top-1 -right-1 bg-ink border border-line rounded-full w-5 h-5 text-[10px]">✕</button>
    </div>
  );
}
