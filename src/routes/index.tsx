import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, type FormEvent } from "react";
import {
  Search,
  Loader2,
  Droplets,
  Wind,
  MapPin,
  History,
  AlertCircle,
  MoreVertical,
  Mic,
  Camera,
  Compass,
  CornerDownLeft,
} from "lucide-react";
import { getWeather, getHistory, resolveCityFromCoords, type WeatherResult, type HistoryEntry } from "@/lib/weather.functions";
import { INDIAN_STATES, INDIAN_CITIES_BY_STATE } from "@/lib/indian-states";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WeatherCast — Live Weather for India" },
      {
        name: "description",
        content:
          "Auto-detect your location and get live weather with a 5-day forecast for every Indian city, state and union territory.",
      },
      { property: "og:title", content: "WeatherCast — Live Weather for India" },
      {
        property: "og:description",
        content: "Live weather and a 5-day forecast for every Indian state and union territory.",
      },
    ],
  }),
  component: WeatherPage,
});

function WeatherPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const getWeatherFn = useServerFn(getWeather);
  const getHistoryFn = useServerFn(getHistory);
  const resolveCityFn = useServerFn(resolveCityFromCoords);

  const [city, setCity] = useState("");
  const [submitted, setSubmitted] = useState<string>("");
  const [geoStatus, setGeoStatus] = useState<"idle" | "detecting" | "granted" | "denied">("idle");

  const history = useQuery({
    queryKey: ["history"],
    queryFn: () => getHistoryFn(),
  });

  const weather = useMutation({
    mutationFn: (q: string) => getWeatherFn({ data: { city: q } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
      router.invalidate();
    },
  });

  const runSearch = (q: string) => {
    setCity(q);
    setSubmitted(q);
    weather.mutate(q);
  };

  const detectLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("denied");
      runSearch("Kanpur");
      return;
    }
    setGeoStatus("detecting");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await resolveCityFn({
            data: { lat: pos.coords.latitude, lon: pos.coords.longitude },
          });
          setGeoStatus("granted");
          runSearch(res.city);
        } catch {
          setGeoStatus("denied");
          runSearch("Kanpur");
        }
      },
      () => {
        setGeoStatus("denied");
        runSearch("Kanpur");
      },
      { timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  };

  const hasTriggeredRef = useRef(false);
  useEffect(() => {
    if (!hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      detectLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = city.trim();
    if (!q) return;
    runSearch(q);
  };

  const onHistoryClick = (c: string) => {
    runSearch(c);
  };

  const sceneType = getSceneType(weather.data);

  return (
    <div className="relative min-h-screen text-[#e3e3e3] px-2 sm:px-4 py-4 sm:py-8 font-sans overflow-hidden">
      <FullScreenWeatherBackground type={sceneType} />
      <div className="relative z-10">
      <div className="mx-auto max-w-xl space-y-4">

        {/* WeatherCast Header */}
        <header className="flex items-center justify-between px-2 pt-2 pb-1">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-2xl bg-gradient-to-br from-[#8ab4f8] to-[#4285F4] flex items-center justify-center shadow-md">
              <Compass className="size-5 text-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xl font-bold tracking-tight text-white">WeatherCast</span>
              <span className="text-[10px] text-[#9aa0a6] font-medium">Live · India</span>
            </div>
          </div>

          <div className="size-8 rounded-full border border-zinc-700 overflow-hidden bg-gradient-to-br from-rose-500 to-amber-500 p-[1.5px] cursor-pointer">
            <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center text-xs font-semibold text-white">
              IN
            </div>
          </div>
        </header>

        {/* Search Bar */}
        <form onSubmit={onSubmit} className="relative">
          <div className="flex items-center gap-2 rounded-full bg-[#303134]/90 backdrop-blur border border-transparent focus-within:border-zinc-700 px-4 py-3 shadow-md">
            <Search className="size-5 text-[#9aa0a6] shrink-0" />
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Search city, e.g. Kanpur, Mumbai, Jaipur"
              className="flex-1 bg-transparent border-none outline-none text-[#e8eaed] placeholder-[#9aa0a6] text-base"
              aria-label="Search city"
            />
            <div className="flex items-center gap-3 text-[#9aa0a6] shrink-0">
              <Mic className="size-5 cursor-pointer hover:text-white transition" />
              <Camera className="size-5 cursor-pointer hover:text-white transition" />
              {city.trim() && city !== submitted && (
                <button type="submit" className="text-primary hover:scale-105 transition" title="Submit search">
                  <CornerDownLeft className="size-5 text-[#4285F4]" />
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Precise Location Box */}
        <div className="rounded-2xl bg-[#202124]/85 backdrop-blur border border-[#3c4043] p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#9aa0a6]">
                <MapPin className="size-4 text-[#8ab4f8]" />
                <span className="text-xs uppercase font-semibold tracking-wider">Current Location</span>
              </div>
              <h2 className="text-lg font-bold text-white flex items-center gap-1.5">
                {weather.data ? `${weather.data.city}, ${weather.data.country}` : submitted}
              </h2>
            </div>
            <button className="p-1.5 hover:bg-[#303134] rounded-full text-[#dae0e5] transition">
              <MoreVertical className="size-5" />
            </button>
          </div>

          <button
            onClick={detectLocation}
            disabled={geoStatus === "detecting"}
            className="flex items-center gap-2 text-xs font-semibold text-[#8ab4f8] hover:bg-[#303134]/50 border border-[#3c4043] rounded-full px-3 py-1.5 transition w-fit disabled:opacity-60"
          >
            {geoStatus === "detecting" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Compass className="size-3.5" />
            )}
            <span>
              {geoStatus === "detecting"
                ? "Detecting your location…"
                : geoStatus === "granted"
                  ? "Location auto-detected"
                  : geoStatus === "denied"
                    ? "Retry precise location"
                    : "Use precise location"}
            </span>
          </button>
        </div>

        {/* Error State */}
        {weather.isError && !weather.isPending && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 backdrop-blur p-4 flex items-start gap-3">
            <AlertCircle className="size-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-rose-300">Couldn't fetch weather</p>
              <p className="text-xs text-zinc-400">{(weather.error as Error).message}</p>
            </div>
          </div>
        )}

        {/* Pending state loader */}
        {weather.isPending && (
          <div className="rounded-3xl bg-[#202124]/85 backdrop-blur border border-[#3c4043] p-8 flex flex-col items-center justify-center gap-3 text-[#9aa0a6] min-h-[300px]">
            <Loader2 className="size-8 text-[#8ab4f8] animate-spin" />
            <p className="text-sm font-medium animate-pulse">
              Loading live WeatherCast for {submitted || "your location"}…
            </p>
          </div>
        )}

        {/* Live Weather Card */}
        {weather.data && !weather.isPending && (
          <GoogleWeatherPanel data={weather.data} />
        )}

        {/* Browse states & territories section */}
        <StatesGrid onPick={onHistoryClick} />

        {/* Search history list */}
        <HistorySection
          entries={history.data ?? []}
          loading={history.isLoading}
          onPick={onHistoryClick}
        />

        {/* Footer info */}
        <footer className="text-center text-[11px] text-[#9aa0a6] pt-4 pb-4 space-y-1 border-t border-[#3c4043]/30">
          <p>Weather data provided by the official OpenWeatherMap API</p>
          <p>© 2026 WeatherCast India</p>
        </footer>

      </div>
      </div>
    </div>
  );
}

// Weather panel
function GoogleWeatherPanel({ data }: { data: WeatherResult }) {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  let warningMessage = "";
  let warningType: "heat" | "warm" | "pleasant" | "rain" | "cold" = "pleasant";

  const temp = data.temperature;
  const desc = data.description.toLowerCase();
  const isRain = desc.includes("rain") || desc.includes("drizzle");
  const isStorm = desc.includes("thunder") || desc.includes("storm");

  if (temp >= 35) {
    warningMessage = `Excessive heat · ${data.city}, ${data.country}. Outdoor work should be limited.`;
    warningType = "heat";
  } else if (temp >= 28) {
    warningMessage = `Warm day · ${data.city}, ${data.country}. Stay hydrated.`;
    warningType = "warm";
  } else if (isRain || isStorm) {
    warningMessage = `Rain expected · Precipitation in ${data.city}. Carry an umbrella!`;
    warningType = "rain";
  } else if (temp < 15) {
    warningMessage = `Chilly weather warning · ${data.city}, ${data.country}. Keep warm.`;
    warningType = "cold";
  } else {
    warningMessage = `Pleasant weather · Great day to be outside in ${data.city}!`;
    warningType = "pleasant";
  }

  const warningColors = {
    heat: "bg-[#fce8e6] text-[#c5221f] border-red-200 dark:bg-[#3c1e1e] dark:text-[#f28b82] border-transparent",
    warm: "bg-[#fef7e0] text-[#b06000] border-amber-200 dark:bg-[#3c301a] dark:text-[#fdd663] border-transparent",
    rain: "bg-[#e8f0fe] text-[#1967d2] border-blue-200 dark:bg-[#1a2b4c] dark:text-[#8ab4f8] border-transparent",
    cold: "bg-[#f1f3f4] text-[#5f6368] border-gray-200 dark:bg-[#303134] dark:text-[#e8eaed] border-transparent",
    pleasant: "bg-[#e6f4ea] text-[#137333] border-green-200 dark:bg-[#1e352f] dark:text-[#81c995] border-transparent",
  };

  return (
    <div className="rounded-3xl bg-[#202124]/85 backdrop-blur border border-[#3c4043] overflow-hidden shadow-lg space-y-4">

      <div className="px-4 pt-4 flex items-center justify-between">
        <h3 className="text-xl font-bold text-white tracking-wide">Weather</h3>
        <button className="p-1 text-[#9aa0a6] hover:text-white rounded-full hover:bg-zinc-800 transition">
          <MoreVertical className="size-5" />
        </button>
      </div>

      <div className="px-5 flex items-center justify-between gap-2">
        <div className="space-y-1">
          <div className="text-xs text-[#bdc1c6] font-medium uppercase tracking-wider">Now</div>
          <div className="flex items-start">
            <span className="text-6xl sm:text-7xl font-light text-white tracking-tighter">{data.temperature}</span>
            <span className="text-3xl font-light text-[#8ab4f8] mt-1">°</span>
            <div className="ml-3 size-4 rounded-full bg-[#FBBC05] shadow-[0_0_12px_rgba(251,188,5,0.7)] animate-pulse" />
          </div>
        </div>

        <div className="text-right space-y-1">
          <div className="text-base font-semibold text-white capitalize">{data.description}</div>
          <div className="text-xs text-[#bdc1c6]">Feels like {data.feelsLike}°</div>
          <div className="text-xs text-[#9aa0a6] flex items-center justify-end gap-2 mt-1">
            <span className="flex items-center gap-0.5"><Droplets className="size-3 text-[#8ab4f8]" /> {data.humidity}%</span>
            <span className="flex items-center gap-0.5"><Wind className="size-3 text-[#81c995]" /> {data.windSpeed.toFixed(1)} m/s</span>
          </div>
        </div>
      </div>

      <div className="px-4">
        <div className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-snug font-medium shadow-sm transition-all duration-300 ${warningColors[warningType]}`}>
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{warningMessage}</span>
        </div>
      </div>

      {/* Hourly Scrolling list */}
      <div className="overflow-x-auto scrollbar-none flex gap-6 px-5 py-2">
        {data.hourly?.map((h, i) => (
          <div key={i} className="flex flex-col items-center text-center space-y-1.5 shrink-0 min-w-[40px]">
            <span className="text-xs font-semibold text-white">{h.temp}°</span>
            <img
              src={`https://openweathermap.org/img/wn/${h.icon}.png`}
              alt={h.description}
              className="size-8 object-contain"
            />
            <span className="text-[10px] text-[#bdc1c6] font-medium">{h.time}</span>
          </div>
        ))}
      </div>

      {/* Daily Forecast row of cards/buttons */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-5 gap-1.5">
          {data.forecast.map((f, index) => {
            const dateObj = new Date(f.date);
            const isSelected = index === selectedDayIndex;
            const weekday = dateObj.toLocaleDateString("en-US", { weekday: "short" });

            return (
              <button
                key={f.date}
                type="button"
                onClick={() => setSelectedDayIndex(index)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                  isSelected
                    ? "bg-[#303134] border-[#8ab4f8] text-white shadow-sm ring-1 ring-[#8ab4f8]"
                    : "bg-[#282a2d]/40 border-transparent hover:border-[#3c4043] text-[#bdc1c6]"
                }`}
              >
                <span className="text-[10px] font-bold uppercase">{weekday}</span>
                <img
                  src={`https://openweathermap.org/img/wn/${f.icon}.png`}
                  alt={f.description}
                  className="size-8 object-contain my-1"
                />
                <span className="text-[10px] font-semibold text-white leading-tight">
                  {f.temp}°
                </span>
                <span className="text-[9px] text-[#9aa0a6] font-medium capitalize line-clamp-1 mt-0.5">
                  {f.description.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 bg-[#303134]/30 border border-[#3c4043]/40 rounded-2xl p-3 flex items-center justify-between text-xs text-[#bdc1c6]">
          <span className="font-semibold text-white">
            {new Date(data.forecast[selectedDayIndex].date).toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </span>
          <span className="capitalize text-[#8ab4f8] font-medium">
            {data.forecast[selectedDayIndex].description} · {data.forecast[selectedDayIndex].temp}°C
          </span>
        </div>
      </div>

    </div>
  );
}

// Decide scene type from weather
function getSceneType(data: WeatherResult | undefined): "sunny" | "rainy" | "cloudy" | "cold" | "thunder" {
  if (!data) return "sunny";
  const temp = data.temperature;
  const desc = data.description.toLowerCase();
  const isRain = desc.includes("rain") || desc.includes("drizzle");
  const isStorm = desc.includes("thunder") || desc.includes("storm");
  const isCloudy = desc.includes("cloud");

  if (isStorm) return "thunder";
  if (isRain) return "rainy";
  if (temp < 15) return "cold";
  if (isCloudy) return "cloudy";
  return "sunny";
}

// Full-page animated weather background
function FullScreenWeatherBackground({ type }: { type: "sunny" | "rainy" | "cloudy" | "cold" | "thunder" }) {
  const skyGradients: Record<string, string> = {
    sunny: "from-[#1a5fa8] via-[#3d84c4] to-[#171719]",
    rainy: "from-[#0f1824] via-[#1c2733] to-[#171719]",
    cloudy: "from-[#2a323a] via-[#3a444d] to-[#171719]",
    cold: "from-[#16324a] via-[#2a4d68] to-[#171719]",
    thunder: "from-[#0a0d14] via-[#151a24] to-[#171719]",
  };

  return (
    <div className={`fixed inset-0 -z-10 bg-gradient-to-b ${skyGradients[type]}`}>
      <style>{`
        @keyframes bgFloatCloud {
          0% { transform: translateX(-30vw); }
          100% { transform: translateX(130vw); }
        }
        @keyframes bgFallDrop {
          0% { transform: translateY(-10px); opacity: 0; }
          15% { opacity: 0.8; }
          100% { transform: translateY(110vh); opacity: 0; }
        }
        @keyframes bgFallSnow {
          0% { transform: translateY(-10px) translateX(0); opacity: 0; }
          15% { opacity: 0.9; }
          100% { transform: translateY(110vh) translateX(30px); opacity: 0; }
        }
        @keyframes bgSpinRays {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes bgFlashBolt {
          0%, 92%, 100% { opacity: 0; }
          94%, 97% { opacity: 0.85; }
        }
      `}</style>

      {type === "sunny" && (
        <>
          <div
            className="absolute top-16 right-16 size-24 rounded-full bg-[#FFD54F] shadow-[0_0_100px_rgba(255,213,79,0.6)] opacity-70"
            style={{ animation: "bgSpinRays 20s linear infinite" }}
          />
          {[8, 40, 68].map((left, i) => (
            <div
              key={i}
              className="absolute opacity-25"
              style={{
                top: `${8 + i * 7}%`,
                left: `${left}%`,
                animation: `bgFloatCloud ${35 + i * 8}s linear infinite`,
                animationDelay: `${-i * 12}s`,
              }}
            >
              <div className="h-6 w-24 bg-white rounded-full" />
              <div className="h-6 w-16 bg-white rounded-full -mt-3 ml-4" />
            </div>
          ))}
        </>
      )}

      {type === "cloudy" && [4, 30, 55, 80].map((left, i) => (
        <div
          key={i}
          className="absolute opacity-25"
          style={{
            top: `${6 + i * 8}%`,
            left: `${left}%`,
            animation: `bgFloatCloud ${30 + i * 6}s linear infinite`,
            animationDelay: `${-i * 9}s`,
          }}
        >
          <div className="h-7 w-28 bg-white rounded-full" />
          <div className="h-7 w-18 bg-white rounded-full -mt-3.5 ml-5" />
        </div>
      ))}

      {(type === "rainy" || type === "thunder") && (
        <>
          {[6, 32, 58, 82].map((left, i) => (
            <div
              key={i}
              className="absolute opacity-30"
              style={{ top: `${5 + i * 5}%`, left: `${left}%` }}
            >
              <div className="h-8 w-32 bg-[#4a5568] rounded-full" />
              <div className="h-8 w-20 bg-[#4a5568] rounded-full -mt-4 ml-6" />
            </div>
          ))}
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-0.5 h-6 bg-[#8ab4f8] rounded-full opacity-60"
              style={{
                left: `${(i * 2.5) % 100}%`,
                top: "-5%",
                animation: `bgFallDrop ${0.8 + (i % 4) * 0.2}s linear infinite`,
                animationDelay: `${(i % 10) * 0.15}s`,
              }}
            />
          ))}
          {type === "thunder" && (
            <div
              className="absolute top-[10%] left-[45%] w-6 h-20 bg-[#FFD54F]"
              style={{
                clipPath: "polygon(50% 0%, 20% 55%, 45% 55%, 30% 100%, 80% 40%, 55% 40%)",
                animation: "bgFlashBolt 3s ease-in-out infinite",
              }}
            />
          )}
        </>
      )}

      {type === "cold" && Array.from({ length: 45 }).map((_, i) => (
        <div
          key={i}
          className="absolute size-2 rounded-full bg-white/80"
          style={{
            left: `${(i * 2.2) % 100}%`,
            top: "-5%",
            animation: `bgFallSnow ${4 + (i % 5) * 0.8}s linear infinite`,
            animationDelay: `${(i % 12) * 0.4}s`,
          }}
        />
      ))}
    </div>
  );
}

function HistorySection({
  entries,
  loading,
  onPick,
}: {
  entries: HistoryEntry[];
  loading: boolean;
  onPick: (city: string) => void;
}) {
  return (
    <section className="rounded-2xl bg-[#202124]/85 backdrop-blur border border-[#3c4043] p-4 space-y-3">
      <div className="flex items-center gap-2 text-white">
        <History className="size-4.5 text-[#8ab4f8]" />
        <h3 className="text-sm font-semibold">Recent weather searches</h3>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[#9aa0a6] text-xs">
          <Loader2 className="size-3.5 animate-spin" />
          <span>Loading search history…</span>
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-[#9aa0a6]">
          Your last searches will appear here. Try searching a city.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {entries.slice(0, 4).map((e) => (
            <button
              key={e.id}
              onClick={() => onPick(e.city)}
              className="flex items-center justify-between p-2.5 rounded-xl bg-[#282a2d]/60 border border-[#3c4043]/40 hover:bg-[#303134] text-left transition"
            >
              <div className="min-w-0 pr-1">
                <p className="text-xs font-semibold text-white truncate">{e.city}</p>
                <p className="text-[10px] text-[#9aa0a6] capitalize truncate">{e.description}</p>
              </div>
              <span className="text-xs font-bold text-[#8ab4f8] bg-[#303134] px-1.5 py-0.5 rounded-md">
                {Math.round(Number(e.temperature))}°
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function StatesGrid({ onPick }: { onPick: (city: string) => void }) {
  const [openState, setOpenState] = useState<string | null>(null);

  return (
    <section className="rounded-2xl bg-[#202124]/85 backdrop-blur border border-[#3c4043] p-4 space-y-3">
      <div className="flex items-center gap-2 text-white">
        <MapPin className="size-4.5 text-[#8ab4f8]" />
        <h3 className="text-sm font-semibold">Explore by State & Union Territory</h3>
      </div>
      <p className="text-xs text-[#9aa0a6]">
        Select any Indian state below to browse its major cities and view live weather.
      </p>

      <div className="max-h-[220px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-700">
        {INDIAN_STATES.map((s) => {
          const isOpen = openState === s.state;
          const cities = INDIAN_CITIES_BY_STATE[s.state] ?? [s.city];
          return (
            <div key={s.state} className="rounded-xl border border-[#3c4043]/60 bg-[#282a2d]/30 overflow-hidden">
              <button
                onClick={() => setOpenState(isOpen ? null : s.state)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#303134]/40 transition text-xs"
              >
                <div>
                  <span className="font-semibold text-[#e8eaed]">{s.state}</span>
                  <span className="text-[10px] text-[#9aa0a6] block">Capital · {s.city}</span>
                </div>
                <span className="text-[10px] font-bold text-[#8ab4f8] bg-[#303134] px-2 py-0.5 rounded-md border border-[#3c4043]">
                  {isOpen ? "Close" : `${cities.length} cities`}
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-[#3c4043]/60 bg-[#171719]/40 p-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {cities.map((c) => (
                      <button
                        key={c}
                        onClick={() => onPick(c)}
                        className="text-left rounded-lg bg-[#303134] hover:bg-[#8ab4f8] hover:text-[#202124] border border-[#3c4043]/30 px-2 py-1 text-[11px] text-[#bdc1c6] font-medium transition truncate"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}