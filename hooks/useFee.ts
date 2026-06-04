import useSWR from "swr";

const DEFAULT_BASE_FEE = 0.71;
const FEE_PERCENT = 0.0035;

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useFee() {
  const { data, isLoading } = useSWR("/api/fee", fetcher, {
    fallbackData: { baseFee: DEFAULT_BASE_FEE },
    dedupingInterval: 30_000,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  return {
    baseFee: data?.baseFee ?? DEFAULT_BASE_FEE,
    feePercent: FEE_PERCENT,
    isLoading,
  };
}
