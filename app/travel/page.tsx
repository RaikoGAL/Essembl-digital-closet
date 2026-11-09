"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { ItemThumb } from "@/components/ItemThumb";
import { OutfitCollage } from "@/components/OutfitCollage";
import { Button, Card, ErrorBanner, Field, PageHeader, inputCls } from "@/components/ui";
import { ai } from "@/lib/ai-client";
import { db, uid } from "@/lib/db";
import type { TravelPlan } from "@/lib/types";
import { fetchDailyForecast, geocode, weatherEmoji, type DailyForecast } from "@/lib/weather";

export default function TravelPage() {
  const items = useLiveQuery(() => db.items.toArray(), []);
  const [dest, setDest] = useState("");
  const [start, setStart] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [end, setEnd] = useState(() => new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10));
  const [activities, setActivities] = useState("");
  const [luggage, setLuggage] = useState("Carry-on");
  const [forecast, setForecast] = useState<DailyForecast[] | null>(null);
  const [plan, setPlan] = useState<TravelPlan | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const byId = new Map((items ?? []).map((i) => [i.id, i]));

  const run = async () => {
    setError(null);
    setPlan(null);
    setSaved(false);
    try {
      setLoading("Finding destination…");
      const g = await geocode(dest);
      if (!g) throw new Error("Couldn't find that destination.");
      setLoading("Checking the forecast…");
      const fc = await fetchDailyForecast(g.lat, g.lon, start, end);
      setForecast(fc);
      setLoading("Packing your capsule…");
      const p = await ai.travel({
        destination: g.label,
        days: fc.map((d) => ({ date: d.date, weather: `${d.label}, ${d.minC}–${d.maxC}°C, ${d.precipProb}% rain` })),
        activities: activities || undefined,
        luggage: luggage || undefined,
      });
      setPlan(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  };

  const saveAll = async () => {
    if (!plan) return;
    const folderId = uid();
    await db.folders.add({ id: folderId, name: `✈️ ${dest}`, createdAt: Date.now() });
    for (const d of plan.days) {
      if (d.itemIds.length < 2) continue;
      await db.outfits.add({ id: uid(), createdAt: Date.now(), name: `${dest} · ${d.label}`, itemIds: d.itemIds, occasion: d.weather, explanation: d.note, source: "travel", forDate: d.date, wornDates: [], folderId });
    }
    setSaved(true);
  };

  const packing = plan?.packingItemIds.map((id) => byId.get(id)).filter(Boolean) ?? [];

  return (
    <div>
      <PageHeader title="Travel wardrobe" subtitle="A capsule packed for the forecast" back="/" />
      <div className="px-4 pt-4">
        <Field label="Destination">
          <input className={inputCls} placeholder="Lisbon, Tokyo, New York…" value={dest} onChange={(e) => setDest(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" className={inputCls} value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <Field label="Activities (optional)">
          <input className={inputCls} placeholder="Sightseeing, two dinners out, a conference…" value={activities} onChange={(e) => setActivities(e.target.value)} />
        </Field>
        <Field label="Luggage">
          <div className="grid grid-cols-3 gap-2">
            {["Backpack", "Carry-on", "Checked bag"].map((l) => (
              <button key={l} onClick={() => setLuggage(l)} className={`py-2 rounded-xl text-sm border ${luggage === l ? "bg-paper text-ink border-paper" : "border-line text-paper/80"}`}>{l}</button>
            ))}
          </div>
        </Field>
        <Button size="lg" onClick={run} loading={!!loading} disabled={!dest.trim() || (items?.length ?? 0) < 3}>
          {loading ?? "Plan my trip"}
        </Button>
        {(items?.length ?? 0) < 3 && <p className="text-xs text-muted text-center mt-2">Add a few items to your closet first.</p>}
      </div>

      <ErrorBanner error={error} />

      {forecast && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 mt-5">
          {forecast.map((d) => (
            <Card key={d.date} className="p-2.5 min-w-[72px] text-center">
              <div className="text-[10px] text-muted">{new Date(d.date).toLocaleDateString(undefined, { weekday: "short" })}</div>
              <div className="text-xl">{weatherEmoji(d.code)}</div>
              <div className="text-xs">{d.maxC}° <span className="text-muted">{d.minC}°</span></div>
            </Card>
          ))}
        </div>
      )}

      {plan && (
        <div className="px-4 mt-5 space-y-5">
          <Card className="p-4">
            <p className="text-sm leading-relaxed">{plan.summary}</p>
          </Card>
          <div>
            <h3 className="font-semibold mb-2">Packing list · {packing.length} pieces</h3>
            <div className="grid grid-cols-4 gap-2">
              {packing.map((it) => (
                <ItemThumb key={it!.id} item={it!} />
              ))}
            </div>
            {plan.missing.length > 0 && (
              <Card className="p-3 mt-3">
                <p className="text-xs uppercase tracking-wide text-muted mb-1">Still need</p>
                <ul className="text-sm space-y-1">
                  {plan.missing.map((m, i) => (
                    <li key={i}>• {m}</li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
          <div>
            <h3 className="font-semibold mb-2">Outfit per day</h3>
            <div className="space-y-4">
              {plan.days.map((d) => (
                <Card key={d.date} className="overflow-hidden">
                  <OutfitCollage items={d.itemIds.map((id) => byId.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof byId.get>>[]} className="rounded-none" />
                  <div className="p-3">
                    <p className="font-medium text-sm">{d.label} <span className="text-muted font-normal">· {new Date(d.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span></p>
                    <p className="text-xs text-muted">{d.weather}</p>
                    <p className="text-sm mt-1.5 text-paper/85">{d.note}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
          <Button size="lg" onClick={saveAll} disabled={saved}>{saved ? "✓ Saved to a trip folder" : "Save all outfits to a trip folder"}</Button>
        </div>
      )}
    </div>
  );
}
