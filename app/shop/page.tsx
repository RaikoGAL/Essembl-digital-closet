"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { ItemThumb } from "@/components/ItemThumb";
import { OutfitCard } from "@/components/OutfitCard";
import { Button, Card, ErrorBanner, PageHeader, ScoreRing, inputCls, useBlobUrl } from "@/components/ui";
import { ai } from "@/lib/ai-client";
import { db } from "@/lib/db";
import { blobToDataUrl, resizeBlob } from "@/lib/images";
import type { GapReport, PairResult } from "@/lib/types";

const STORES = [
  { name: "Google", url: (q: string) => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}` },
  { name: "Zara", url: (q: string) => `https://www.zara.com/search?searchTerm=${encodeURIComponent(q)}` },
  { name: "ASOS", url: (q: string) => `https://www.asos.com/search/?q=${encodeURIComponent(q)}` },
  { name: "H&M", url: (q: string) => `https://www2.hm.com/en_gb/search-results.html?q=${encodeURIComponent(q)}` },
];

export default function ShopPage() {
  const items = useLiveQuery(() => db.items.toArray(), []);
  const [tab, setTab] = useState<"gaps" | "pair">("gaps");
  const [goals, setGoals] = useState("");
  const [report, setReport] = useState<GapReport | null>(null);
  useEffect(() => {
    try {
      const r = JSON.parse(sessionStorage.getItem("gap-report") || "null");
      if (r && Array.isArray(r.gaps)) setReport(r);
    } catch {
      /* ignore */
    }
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [product, setProduct] = useState<Blob | null>(null);
  const [note, setNote] = useState("");
  const [pair, setPair] = useState<PairResult | null>(null);
  const productUrl = useBlobUrl(product);

  const runGaps = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await ai.gaps(goals || undefined);
      setReport(r);
      try {
        sessionStorage.setItem("gap-report", JSON.stringify(r));
      } catch {
        /* ignore */
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const runPair = async () => {
    if (!product) return;
    setLoading(true);
    setError(null);
    try {
      setPair(await ai.pair(await blobToDataUrl(product), note || undefined));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const byId = new Map((items ?? []).map((i) => [i.id, i]));

  return (
    <div>
      <PageHeader title="Shop smarter" subtitle="Find the gaps, and check before you buy" />
      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 bg-card rounded-full p-1">
          <button onClick={() => setTab("gaps")} className={`py-2 rounded-full text-sm font-medium ${tab === "gaps" ? "bg-paper text-ink" : "text-muted"}`}>Closet gaps</button>
          <button onClick={() => setTab("pair")} className={`py-2 rounded-full text-sm font-medium ${tab === "pair" ? "bg-paper text-ink" : "text-muted"}`}>Should I buy it?</button>
        </div>
      </div>
      <ErrorBanner error={error} />

      {tab === "gaps" ? (
        <div className="px-4 mt-4">
          {(items?.length ?? 0) < 5 ? (
            <Card className="p-5 text-center">
              <div className="text-4xl mb-2">🧩</div>
              <p className="font-semibold">Add at least 5 items for a useful audit</p>
              <p className="text-sm text-muted mt-1">The more of your closet is in here, the better the gap analysis.</p>
            </Card>
          ) : (
            <>
              <input className={inputCls} placeholder="Goals? e.g. more office looks, fewer black items, summer trip" value={goals} onChange={(e) => setGoals(e.target.value)} />
              <Button size="lg" className="mt-3" onClick={runGaps} loading={loading}>{report ? "Re-run closet audit" : "Run closet audit"}</Button>
            </>
          )}

          {loading && <div className="mt-4 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-2xl shimmer" />)}</div>}

          {report && !loading && (
            <div className="mt-5 space-y-4">
              <Card className="p-4">
                <p className="text-sm leading-relaxed">{report.summary}</p>
                {report.strengths.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm">
                    {report.strengths.map((s, i) => (
                      <li key={i} className="flex gap-2"><span>💪</span><span>{s}</span></li>
                    ))}
                  </ul>
                )}
              </Card>
              {report.gaps.map((g, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${g.priority === "high" ? "bg-accent text-ink" : g.priority === "medium" ? "bg-line" : "bg-card border border-line text-muted"}`}>{g.priority}</span>
                    <div className="flex-1">
                      <h4 className="font-semibold">{g.item}</h4>
                      <p className="text-xs text-muted">{g.category} · {g.colorSuggestion}</p>
                    </div>
                  </div>
                  <p className="text-sm mt-2 text-paper/85">{g.why}</p>
                  {g.pairsWith.length > 0 && (
                    <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar">
                      {g.pairsWith.map((id) => byId.get(id)).filter(Boolean).map((it) => <ItemThumb key={it!.id} item={it!} size="xs" />)}
                    </div>
                  )}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {STORES.map((s) => (
                      <a key={s.name} href={s.url(g.searchQuery)} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 rounded-full border border-line hover:bg-card">
                        {s.name} ↗
                      </a>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 mt-4">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setPair(null); setProduct(await resizeBlob(f, 1024, "image/jpeg", 0.85)); } }} />
          {productUrl ? (
            <div className="relative rounded-3xl overflow-hidden bg-card">
              <img src={productUrl} alt="Product" className="w-full max-h-[45vh] object-contain" />
              <button onClick={() => { setProduct(null); setPair(null); }} className="absolute top-3 right-3 bg-ink/70 rounded-full w-9 h-9">✕</button>
            </div>
          ) : (
            <Card className="p-8 text-center">
              <div className="text-5xl mb-3">🛍️</div>
              <h3 className="font-semibold">Screenshot something you want</h3>
              <p className="text-sm text-muted mt-1">A product page, a store photo, or a photo in the fitting room. I&apos;ll check what it goes with in your closet before you pay.</p>
              <Button variant="ghost" size="lg" className="mt-5" onClick={() => fileRef.current?.click()}>Choose image</Button>
            </Card>
          )}
          {product && !pair && (
            <>
              <input className={`${inputCls} mt-3`} placeholder="Notes (price, where, why you like it)" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button size="lg" className="mt-3" onClick={runPair} loading={loading}>Check my closet</Button>
            </>
          )}
          {pair && (
            <div className="mt-4 space-y-4">
              <Card className="p-4 flex items-center gap-4">
                <ScoreRing score={pair.buyScore} size={80} label="buy score" />
                <p className="text-sm flex-1 leading-relaxed">{pair.verdict}</p>
              </Card>
              {pair.similarOwned.length > 0 && (
                <Card className="p-4">
                  <p className="text-sm font-semibold mb-2">You already own something similar</p>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {pair.similarOwned.map((id) => byId.get(id)).filter(Boolean).map((it) => <ItemThumb key={it!.id} item={it!} size="sm" />)}
                  </div>
                </Card>
              )}
              {pair.outfits.length > 0 && <p className="text-sm font-semibold">How you&apos;d wear it</p>}
              {pair.outfits.map((o, i) => (
                <OutfitCard key={i} suggestion={o} source="ideas" compact />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
