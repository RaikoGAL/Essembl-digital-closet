"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { Button, Card, Field, PageHeader, Toggle, inputCls } from "@/components/ui";
import { db, exportBackup, getSettings, importBackup, saveSettings } from "@/lib/db";
import type { Settings } from "@/lib/types";
import { geocode, getPosition, reverseGeocode } from "@/lib/weather";

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [city, setCity] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const counts = useLiveQuery(async () => ({ items: await db.items.count(), outfits: await db.outfits.count() }), []);

  useEffect(() => {
    getSettings().then((x) => {
      setS(x);
      setCity(x.locationName ?? "");
    });
  }, []);

  const patch = async (p: Partial<Settings>) => setS(await saveSettings(p));

  if (!s) return <div className="p-10 text-center text-muted">Loading…</div>;

  return (
    <div>
      <PageHeader title="Settings" back="/" />
      <div className="px-4 pt-4 space-y-6">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Your style</h3>
          <Field label="How do you dress?">
            <div className="grid grid-cols-3 gap-2">
              {(["womenswear", "menswear", "mixed"] as const).map((p) => (
                <button key={p} onClick={() => patch({ presentation: p })} className={`py-2 rounded-xl text-sm border capitalize ${s.presentation === p ? "bg-paper text-ink border-paper" : "border-line text-paper/80"}`}>{p}</button>
              ))}
            </div>
          </Field>
          <Field label="Style profile" hint="Used in every suggestion. Mention what you love, what you avoid, your body-shape notes, dress codes at work, colors you never wear…">
            <textarea className={inputCls} rows={4} value={s.styleProfile} onChange={(e) => setS({ ...s, styleProfile: e.target.value })} onBlur={() => patch({ styleProfile: s.styleProfile })} placeholder="e.g. Minimal streetwear, mostly neutrals with one pop color. Office is smart-casual. I hate skinny jeans. Prefer sneakers over boots." />
          </Field>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">Weather & location</h3>
          <div className="flex gap-2">
            <input className={inputCls} placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
            <Button
              variant="ghost"
              loading={busy === "city"}
              onClick={async () => {
                setBusy("city");
                const g = await geocode(city);
                if (g) {
                  await patch({ lat: g.lat, lon: g.lon, locationName: g.label });
                  setCity(g.label);
                  setMsg(`Location set to ${g.label}`);
                } else setMsg("City not found");
                setBusy(null);
              }}
            >
              Set
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            loading={busy === "gps"}
            onClick={async () => {
              setBusy("gps");
              try {
                const p = await getPosition();
                const name = await reverseGeocode(p.lat, p.lon);
                await patch({ lat: p.lat, lon: p.lon, locationName: name });
                setCity(name ?? "");
                setMsg("Location updated from GPS");
              } catch {
                setMsg("Location permission denied");
              }
              setBusy(null);
            }}
          >
            📍 Use my location
          </Button>
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm">Temperature unit</span>
            <div className="flex bg-ink rounded-full p-0.5 border border-line">
              {(["metric", "imperial"] as const).map((u) => (
                <button key={u} onClick={() => patch({ units: u })} className={`px-3 py-1 rounded-full text-xs ${s.units === u ? "bg-paper text-ink" : "text-muted"}`}>{u === "metric" ? "°C" : "°F"}</button>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">Photos</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Remove backgrounds</p>
              <p className="text-xs text-muted">Runs on your phone, free. First use downloads a ~40 MB model.</p>
            </div>
            <Toggle checked={s.removeBackground} onChange={(v) => patch({ removeBackground: v })} />
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-1">Your data</h3>
          <p className="text-xs text-muted mb-3">
            {counts ? `${counts.items} items · ${counts.outfits} outfits` : ""} — stored only on this device. Export a backup before switching phones or clearing the browser.
          </p>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setBusy("import"); try { const n = await importBackup(f); setMsg(`Imported ${n} items`); } catch { setMsg("Import failed — not a valid backup"); } setBusy(null); }} />
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              loading={busy === "export"}
              onClick={async () => {
                setBusy("export");
                const b = await exportBackup();
                const a = document.createElement("a");
                a.href = URL.createObjectURL(b);
                a.download = `closet-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                setBusy(null);
              }}
            >
              Export backup
            </Button>
            <Button variant="ghost" loading={busy === "import"} onClick={() => fileRef.current?.click()}>Import backup</Button>
          </div>
          <Button
            variant="danger"
            size="sm"
            className="mt-3 w-full"
            onClick={async () => {
              if (!confirm("Delete ALL items and outfits on this device? This cannot be undone.")) return;
              await db.transaction("rw", db.items, db.outfits, db.folders, async () => {
                await db.items.clear();
                await db.outfits.clear();
                await db.folders.clear();
              });
              setMsg("Closet cleared");
            }}
          >
            Clear closet
          </Button>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-1">Install on your phone</h3>
          <p className="text-xs text-muted">
            iPhone: Safari → Share → <b>Add to Home Screen</b>. Android: Chrome → ⋮ → <b>Install app</b>. It then opens full-screen like a native app and works offline for browsing your closet.
          </p>
        </Card>

        {msg && <p className="text-center text-sm text-accent">{msg}</p>}
        <p className="text-center text-xs text-muted pb-6">Digital Closet · AI by Claude · weather by Open-Meteo</p>
      </div>
    </div>
  );
}
