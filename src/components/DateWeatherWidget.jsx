import React, { useEffect, useState } from 'react';
import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, CloudDrizzle } from 'lucide-react';

// Buenos Aires fallback when the browser denies/lacks geolocation.
const FALLBACK_COORDS = { latitude: -34.6037, longitude: -58.3816 };

const WEATHER_ICON = (code) => {
  if (code === 0 || code === 1) return Sun;
  if (code === 2 || code === 3) return Cloud;
  if ([45, 48].includes(code)) return CloudFog;
  if ([51, 53, 55, 56, 57].includes(code)) return CloudDrizzle;
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return CloudRain;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return CloudSnow;
  if ([95, 96, 99].includes(code)) return CloudLightning;
  return Cloud;
};

export default function DateWeatherWidget() {
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = (coords) => {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,weather_code`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.current) setWeather({ temp: Math.round(d.current.temperature_2m), code: d.current.weather_code }); })
        .catch(() => {});
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => load({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => load(FALLBACK_COORDS),
        { timeout: 4000 }
      );
    } else {
      load(FALLBACK_COORDS);
    }
  }, []);

  const dayLabel = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeLabel = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const Icon = weather ? WEATHER_ICON(weather.code) : Cloud;

  return (
    <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-card border border-border text-sm">
      <div className="text-right leading-tight">
        <p className="font-medium capitalize text-xs text-muted-foreground">{dayLabel}</p>
        <p className="font-semibold">{timeLabel}</p>
      </div>
      {weather && (
        <>
          <div className="w-px h-7 bg-border" />
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Icon className="w-4 h-4" />
            <span className="font-semibold text-foreground">{weather.temp}°C</span>
          </div>
        </>
      )}
    </div>
  );
}
