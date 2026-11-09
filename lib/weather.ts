"use client";
import type { WeatherSnapshot } from "./types";

export const WMO: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  56: "Freezing drizzle", 57: "Freezing drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
  66: "Freezing rain", 67: "Freezing rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow",
  77: "Snow grains", 80: "Rain showers", 81: "Rain showers", 82: "Violent showers",
  85: "Snow showers", 86: "Snow showers", 95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Thunderstorm w/ hail",
};

export function weatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

export async function getPosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((res, rej) => {
    if (!("geolocation" in navigator)) return rej(new Error("Geolocation unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => rej(e),
      { timeout: 10000, maximumAge: 10 * 60 * 1000 }
    );
  });
}

export async function reverseGeocode(lat: number, lon: number): Promise<string | undefined> {
  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    const j = await r.json();
    return j.city || j.locality || j.principalSubdivision || j.countryName;
  } catch {
    return undefined;
  }
}

export async function geocode(name: string): Promise<{ lat: number; lon: number; label: string } | null> {
  const r = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`
  );
  const j = await r.json();
  const hit = j.results?.[0];
  if (!hit) return null;
  return { lat: hit.latitude, lon: hit.longitude, label: [hit.name, hit.country].filter(Boolean).join(", ") };
}

export async function fetchCurrentWeather(lat: number, lon: number, locationName?: string): Promise<WeatherSnapshot> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&forecast_days=1&timezone=auto`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Weather unavailable");
  const j = await r.json();
  const code = j.current.weather_code as number;
  return {
    tempC: Math.round(j.current.temperature_2m),
    feelsLikeC: Math.round(j.current.apparent_temperature),
    minC: Math.round(j.daily.temperature_2m_min[0]),
    maxC: Math.round(j.daily.temperature_2m_max[0]),
    precipProb: j.daily.precipitation_probability_max?.[0] ?? 0,
    code,
    label: WMO[code] ?? "—",
    windKmh: Math.round(j.current.wind_speed_10m),
    locationName,
  };
}

export interface DailyForecast {
  date: string;
  minC: number;
  maxC: number;
  precipProb: number;
  code: number;
  label: string;
}

export async function fetchDailyForecast(lat: number, lon: number, start: string, end: string): Promise<DailyForecast[]> {
  // Open-Meteo forecast covers up to 16 days ahead; beyond that we fall back to climate normals via the same API.
  const today = new Date();
  const endDate = new Date(end);
  const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / 86400000);
  let url: string;
  if (diffDays <= 15) {
    url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto` +
      `&start_date=${start}&end_date=${end}`;
  } else {
    // Historical same-dates last year as a climate proxy
    const sy = new Date(start); sy.setFullYear(sy.getFullYear() - 1);
    const ey = new Date(end); ey.setFullYear(ey.getFullYear() - 1);
    const f = (d: Date) => d.toISOString().slice(0, 10);
    url =
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=auto` +
      `&start_date=${f(sy)}&end_date=${f(ey)}`;
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error("Forecast unavailable");
  const j = await r.json();
  const d = j.daily;
  return (d.time as string[]).map((t, i) => {
    const code = d.weather_code?.[i] ?? 0;
    const precip = d.precipitation_probability_max?.[i] ?? (d.precipitation_sum?.[i] > 1 ? 60 : 10);
    // shift archive dates forward one year for display
    const date = diffDays <= 15 ? t : (() => { const x = new Date(t); x.setFullYear(x.getFullYear() + 1); return x.toISOString().slice(0, 10); })();
    return {
      date,
      minC: Math.round(d.temperature_2m_min[i]),
      maxC: Math.round(d.temperature_2m_max[i]),
      precipProb: precip,
      code,
      label: WMO[code] ?? "—",
    };
  });
}

export function describeWeather(w: WeatherSnapshot, units: "metric" | "imperial" = "metric"): string {
  const t = (c: number) => (units === "imperial" ? `${Math.round((c * 9) / 5 + 32)}°F` : `${c}°C`);
  return `${w.label}, ${t(w.tempC)} (feels ${t(w.feelsLikeC)}), range ${t(w.minC)}–${t(w.maxC)}, ${w.precipProb}% rain chance, wind ${w.windKmh} km/h`;
}
