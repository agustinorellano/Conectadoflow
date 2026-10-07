import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			// Without a staleTime, React Query treats every mount as stale and
			// refetches anyway — navigating Dashboard -> Ventas -> Dashboard
			// re-fetched everything from scratch both times. 60s keeps data
			// fresh enough while actually caching between screens.
			staleTime: 60 * 1000,
			gcTime: 5 * 60 * 1000,
		},
	},
});
