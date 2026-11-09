"use client";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ItemThumb } from "@/components/ItemThumb";
import { OutfitCard } from "@/components/OutfitCard";
import { Button, Card, Chip, ErrorBanner, Section, inputCls } from "@/components/ui";
import { ai } from "@/lib/ai-client";
import { db, getSettings, saveSettings, todayKey } from "@/lib/db";
import type { Outfit, OutfitSuggestion, Settings, WeatherSnapshot } from "@/lib/types";
import { describeWeather, fetchCurrentWeather, getPosition, reverseGeocode, weatherEmoji } from "@/lib/weather";

const MOODS = ["Comfy", "Sharp", "Playful", "Minimal", "Bold", "Cozy"];

export default function TodayPage() {
  const router = useRouter();
  const today = todayKey();
  const items = useLiveQuery(() => db.items.toArray(), []);
  const todays = useLiveQuery(() => db.outfits.where("forDate").equals(today).reverse().sortBy("createdAt"), [today]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherErr, setWeatherErr] = useState<string | null>(null);
  const [plans, setPlans] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<OutfitSuggestion | null>(null);
  const [savedFresh, setSavedFresh] = useState<Outfit | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      if (s.lat != null && s.lon != null) loadWeather(s.lat, s.lon, s.locationName);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadWeather = useCallback(async (lat: number, lon: number, name?: string) => {
    try {
      setWeatherErr(null);
      setWeather(await fetchCurrentWeather(lat, lon, name));
    } catch (e) {
      setWeatherErr((e as Error).message);
    }
  }, []);

  const enableLocation = async () => {
    try {
      const p = await getPosition();
      const name = await reverseGeocode(p.lat, p.lon);
      const s = await saveSettings({ lat: p.lat, lon: p.lon, locationName: name });
      setSettings(s);
      await loadWeather(p.lat, p.lon, name);
    } catch {
      setWeatherErr("Location permission denied. Set your city in Settings.");
    }
  };

  const generate = async (avoid: string[] = []) => {
    setLoading(true);
    setError(null);
    try {
      const recent = (await db.outfits.filter((o) => (o.wornDates ?? []).some((d) => daysAgo(d) <= 3)).toArray()).flatMap((o) => o.itemIds);
      const res = await ai.outfit({
        weather: weather ? describeWeather(weather, settings?.units) : undefined,
        plans: plans || undefined,
        mood: mood || undefined,
        avoidItemIds: avoid,
        recentlyWornIds: Array.from(new Set(recent)).slice(0, 30),
      });
      const o = res.outfits[0];
      if (!o) throw new Error("Couldn't build an outfit from your closet. Try adding more pieces.");
      setFresh(o);
      setSavedFresh(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const latest = todays?.[0];
  const showing: { s: OutfitSuggestion; saved: Outfit | null } | null = fresh
    ? { s: fresh, saved: savedFresh }
    : latest
      ? { s: { name: latest.name, itemIds: latest.itemIds, explanation: latest.explanation ?? "", occasion: latest.occasion ?? "", score: latest.score ?? 0 }, saved: latest }
      : null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const underworn = (items ?? []).filter((i) => i.wearCount === 0).slice(0, 10);

  return (
    <div>
      <header className="px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-2 flex items-start justify-between">
        <div>
          <p className="text-muted text-sm">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/travel" className="w-10 h-10 rounded-full bg-card flex items-center justify-center" aria-label="Travel">✈️</Link>
          <Link href="/settings" className="w-10 h-10 rounded-full bg-card flex items-center justify-center" aria-label="Settings">⚙️</Link>
        </div>
      </header>

      {/* Weather */}
      <div className="px-4 mt-2">
        {weather ? (
          <Card className="p-3.5 flex items-center gap-3">
            <span className="text-3xl">{weatherEmoji(weather.code)}</span>
            <div className="flex-1">
              <div className="font-medium">
                {fmtTemp(weather.tempC, settings?.units)} · {weather.label}
              </div>
              <div className="text-xs text-muted">
                {fmtTemp(weather.minC, settings?.units)} – {fmtTemp(weather.maxC, settings?.units)} · {weather.precipProb}% rain{weather.locationName ? ` · ${weather.locationName}` : ""}
              </div>
            </div>
            <button onClick={() => settings?.lat != null && loadWeather(settings.lat, settings.lon!, settings.locationName)} className="text-muted text-sm">↻</button>
          </Card>
        ) : (
          <Card className="p-3.5 flex items-center gap-3">
            <span className="text-3xl">📍</span>
            <div className="flex-1 text-sm">
              <div className="font-medium">Dress for the weather</div>
              <div className="text-xs text-muted">{weatherErr ?? "Enable location for weather-aware outfits."}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={enableLocation}>Enable</Button>
          </Card>
        )}
      </div>

      {/* Plans & mood */}
      <div className="px-4 mt-4">
        <input className={inputCls} placeholder="Plans today? (office, date night, gym, brunch…)" value={plans} onChange={(e) => setPlans(e.target.value)} />
        <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 -mx-4 px-4">
          {MOODS.map((m) => (
            <Chip key={m} active={mood === m} onClick={() => setMood(mood === m ? null : m)}>{m}</Chip>
          ))}
        </div>
      </div>

      <ErrorBanner error={error} onRetry={() => generate()} />

      {/* Outfit */}
      <div className="px-4 mt-4">
        {items && items.length < 3 ? (
          <Card className="p-5 text-center">
            <div className="text-4xl mb-2">👕👖👟</div>
            <h3 className="font-semibold">Add at least 3 pieces to get outfits</h3>
            <p className="text-sm text-muted mt-1">A top, a bottom and shoes is enough to start.</p>
            <Button className="mt-4" onClick={() => router.push("/closet/add")}>Add items</Button>
          </Card>
        ) : showing && !loading ? (
          <>
            <OutfitCard
              key={showing.s.name + showing.s.itemIds.join()}
              suggestion={showing.s}
              saved={showing.saved}
              source="today"
              forDate={today}
              weather={weather ?? undefined}
              onSaved={(o) => setSavedFresh(o)}
            />
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Button variant="ghost" onClick={() => generate(showing.s.itemIds)} loading={loading}>🔁 Another one</Button>
              <Button variant="ghost" onClick={() => router.push("/studio?ideas=1")}>✨ More ideas</Button>
            </div>
          </>
        ) : (
          <Card className="p-5">
            {loading ? (
              <div className="py-8 text-center">
                <div className="mx-auto w-full aspect-square max-w-[240px] rounded-2xl shimmer mb-4" />
                <p className="text-sm text-muted">Styling you for today…</p>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-lg">Today&apos;s outfit</h3>
                <p className="text-sm text-muted mt-1">Built from your closet, matched to the weather{plans ? " and your plans" : ""}.</p>
                <Button size="lg" className="mt-4" onClick={() => generate()}>Dress me</Button>
              </>
            )}
          </Card>
        )}
      </div>

      {/* Quick actions */}
      <Section title="Quick actions">
        <div className="grid grid-cols-4 gap-2">
          {[
            { href: "/rate", icon: "🤳", label: "Rate look" },
            { href: "/closet/add", icon: "📸", label: "Add item" },
            { href: "/shop", icon: "🛍️", label: "Shop gaps" },
            { href: "/travel", icon: "🧳", label: "Travel" },
          ].map((a) => (
            <Link key={a.href} href={a.href} className="bg-card border border-line rounded-2xl py-3 flex flex-col items-center gap-1.5 active:scale-95 transition">
              <span className="text-2xl">{a.icon}</span>
              <span className="text-[11px] text-muted">{a.label}</span>
            </Link>
          ))}
        </div>
      </Section>

      {underworn.length > 0 && (
        <Section title="Never worn yet" action={<Link href="/closet" className="text-xs text-muted">See closet</Link>}>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
            {underworn.map((i) => (
              <ItemThumb key={i.id} item={i} size="sm" onClick={() => router.push(`/studio?anchor=${i.id}`)} />
            ))}
          </div>
        </Section>
      )}

      {todays && todays.length > 1 && (
        <Section title="Earlier today">
          <div className="flex flex-wrap gap-2">
            {todays.slice(1).map((o) => (
              <Link key={o.id} href={`/outfits/${o.id}`} className="text-xs px-3 py-1.5 rounded-full bg-card border border-line">
                {o.name}
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function fmtTemp(c: number, units: "metric" | "imperial" = "metric") {
  return units === "imperial" ? `${Math.round((c * 9) / 5 + 32)}°` : `${c}°`;
}

function daysAgo(dateKey: string): number {
  return Math.floor((Date.now() - new Date(dateKey).getTime()) / 86400000);
}
