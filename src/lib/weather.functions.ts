import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export type ForecastDay = {
  date: string;
  temp: number;
  description: string;
  icon: string;
};

export type HourlyForecast = {
  time: string;
  temp: number;
  icon: string;
  description: string;
};

export type WeatherResult = {
  city: string;
  country: string;
  temperature: number;
  humidity: number;
  description: string;
  icon: string;
  feelsLike: number;
  windSpeed: number;
  forecast: ForecastDay[];
  hourly?: HourlyForecast[];
};

export type HistoryEntry = {
  id: string;
  city: string;
  temperature: number;
  humidity: number;
  description: string;
  searched_at: string;
};

function getServerSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const getWeather = createServerFn({ method: "POST" })
  .inputValidator((input: { city: string }) =>
    z.object({ city: z.string().min(1).max(100) }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Weather service is not configured. Please add OPENWEATHER_API_KEY.",
      );
    }

    const rawCity = data.city.trim();
    // Restrict lookups to India. Allow user to pass "City, ST" too — we always append country code IN.
    const query = /,\s*in\s*$/i.test(rawCity) ? rawCity : `${rawCity},IN`;
    const city = rawCity;
    const base = "https://api.openweathermap.org/data/2.5";

    const currentRes = await fetch(
      `${base}/weather?q=${encodeURIComponent(query)}&units=metric&appid=${apiKey}`,
    );

    if (currentRes.status === 404) {
      throw new Error(`"${city}" not found in India. Try an Indian city or state capital.`);
    }
    if (!currentRes.ok) {
      throw new Error("Unable to fetch weather right now. Please try again.");
    }

    const current = await currentRes.json();

    const forecastRes = await fetch(
      `${base}/forecast?q=${encodeURIComponent(query)}&units=metric&appid=${apiKey}`,
    );
    if (!forecastRes.ok) {
      throw new Error("Unable to fetch forecast. Please try again.");
    }
    const forecastData = await forecastRes.json();

    // Pick one reading per day at ~12:00, next 5 days
    const byDay = new Map<string, any>();
    for (const entry of forecastData.list as any[]) {
      const date = entry.dt_txt.slice(0, 10);
      const hour = entry.dt_txt.slice(11, 13);
      const existing = byDay.get(date);
      if (!existing || Math.abs(parseInt(hour) - 12) < Math.abs(parseInt(existing.dt_txt.slice(11, 13)) - 12)) {
        byDay.set(date, entry);
      }
    }
    const today = new Date().toISOString().slice(0, 10);
    const forecast: ForecastDay[] = Array.from(byDay.entries())
      .filter(([d]) => d !== today)
      .slice(0, 5)
      .map(([date, entry]) => ({
        date,
        temp: Math.round(entry.main.temp),
        description: entry.weather[0].description,
        icon: entry.weather[0].icon,
      }));

    const hourly: HourlyForecast[] = (forecastData.list as any[]).slice(0, 8).map((entry: any, index: number) => {
      const dt = new Date(entry.dt * 1000);
      let timeStr = dt.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }).toLowerCase();
      timeStr = timeStr.replace(":00", "").trim();
      return {
        time: index === 0 ? "Now" : timeStr,
        temp: Math.round(entry.main.temp),
        icon: entry.weather[0].icon,
        description: entry.weather[0].description,
      };
    });

    const result: WeatherResult = {
      city: current.name,
      country: current.sys?.country ?? "",
      temperature: Math.round(current.main.temp),
      humidity: current.main.humidity,
      description: current.weather[0].description,
      icon: current.weather[0].icon,
      feelsLike: Math.round(current.main.feels_like),
      windSpeed: current.wind?.speed ?? 0,
      forecast,
      hourly,
    };

    // Save to history (best-effort) — use admin client so inserts only happen server-side.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("search_history").insert({
        city: result.city,
        temperature: result.temperature,
        humidity: result.humidity,
        description: result.description,
      });
    } catch (e) {
      console.error("Failed to save history:", e);
    }

    return result;
  });

export const resolveCityFromCoords = createServerFn({ method: "POST" })
  .inputValidator((input: { lat: number; lon: number }) =>
    z.object({ lat: z.number(), lon: z.number() }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) throw new Error("Weather service is not configured.");
    const geoRes = await fetch(
      `https://api.openweathermap.org/geo/1.0/reverse?lat=${data.lat}&lon=${data.lon}&limit=1&appid=${apiKey}`,
    );
    if (!geoRes.ok) throw new Error("Unable to detect location.");
    const geo = (await geoRes.json()) as Array<{ name: string; country: string; state?: string }>;
    const city = geo?.[0]?.name;
    if (!city) throw new Error("Could not resolve city from your location.");
    return { city, country: geo[0].country ?? "", state: geo[0].state ?? "" };
  });


export const getHistory = createServerFn({ method: "GET" }).handler(async () => {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("search_history")
    .select("id, city, temperature, humidity, description, searched_at")
    .order("searched_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return (data ?? []) as HistoryEntry[];
});

