import { useQuery } from '@tanstack/react-query';
import { fetchRates } from '@/lib/currencyRates';

// Shared across every widget that needs to add up amounts entered in
// different currencies (Dashboard, Ventas, IncomeReportCard...) — one
// cached fetch instead of each one hitting the exchange-rate APIs itself.
export function useCurrencyRates() {
  const { data: rates } = useQuery({
    queryKey: ['currencyRates'],
    queryFn: fetchRates,
    staleTime: 10 * 60 * 1000,
  });
  return rates || null;
}
