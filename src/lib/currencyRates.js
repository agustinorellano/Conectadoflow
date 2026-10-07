// Currency conversion rates for Dashboard display only.
// These never touch stored data — amounts in the database keep their
// original value and currency; this only converts a number for showing it.
const CACHE_KEY = 'cf_currency_rates_v1';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

export async function fetchRates() {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.fetchedAt < CACHE_TTL_MS) return parsed;
    }
  } catch { /* ignore cache read errors */ }

  const [oficial, blue, usdBase] = await Promise.all([
    fetch('https://dolarapi.com/v1/dolares/oficial').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('https://dolarapi.com/v1/dolares/blue').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('https://open.er-api.com/v6/latest/USD').then(r => r.ok ? r.json() : null).catch(() => null),
  ]);

  const result = {
    fetchedAt: Date.now(),
    date: oficial?.fechaActualizacion || new Date().toISOString(),
    arsPerUsdOficial: oficial?.venta || null,
    arsPerUsdBlue: blue?.venta || null,
    brlPerUsd: usdBase?.rates?.BRL || null,
    eurPerUsd: usdBase?.rates?.EUR || null,
  };

  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(result)); } catch { /* ignore cache write errors */ }
  return result;
}

// Converts an ARS amount into USD (oficial/blue) and BRL using the given rates.
export function convertFromArs(amountArs, rates) {
  if (!rates) return null;
  return {
    usdOficial: rates.arsPerUsdOficial ? amountArs / rates.arsPerUsdOficial : null,
    usdBlue: rates.arsPerUsdBlue ? amountArs / rates.arsPerUsdBlue : null,
    brl: rates.arsPerUsdOficial && rates.brlPerUsd ? (amountArs / rates.arsPerUsdOficial) * rates.brlPerUsd : null,
  };
}

// General converter used to add up amounts that were entered in different
// currencies (a sale or product can now carry its own `currency`, separate
// from the organization's default) into one consistent total — via USD as
// the pivot. Falls back to returning the amount unconverted (best-effort)
// if a required rate hasn't loaded yet, rather than throwing mid-sum.
export function convertAmount(amount, from, to, rates) {
  const n = Number(amount) || 0;
  if (!from || !to || from === to) return n;
  if (!rates) return n;
  const toUsd = (v, cur) => {
    if (cur === 'USD') return v;
    if (cur === 'ARS') return rates.arsPerUsdOficial ? v / rates.arsPerUsdOficial : null;
    if (cur === 'EUR') return rates.eurPerUsd ? v / rates.eurPerUsd : null;
    return null;
  };
  const fromUsd = (usd, cur) => {
    if (cur === 'USD') return usd;
    if (cur === 'ARS') return rates.arsPerUsdOficial ? usd * rates.arsPerUsdOficial : null;
    if (cur === 'EUR') return rates.eurPerUsd ? usd * rates.eurPerUsd : null;
    return null;
  };
  const usd = toUsd(n, from);
  if (usd == null) return n;
  const converted = fromUsd(usd, to);
  return converted == null ? n : converted;
}
