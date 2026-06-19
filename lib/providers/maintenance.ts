import { isProviderId, type ProviderId } from "./types";

export function getDisabledProviderIds(): ProviderId[] {
  const raw =
    process.env.DISABLED_PROVIDERS ??
    process.env.NEXT_PUBLIC_DISABLED_PROVIDERS ??
    "";
  if (!raw.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ProviderId => s.length > 0 && isProviderId(s));
}

export function isProviderDisabled(id: ProviderId): boolean {
  return getDisabledProviderIds().includes(id);
}

export function areAllProvidersDisabled(ids: ProviderId[]): boolean {
  return ids.length > 0 && ids.every(isProviderDisabled);
}
