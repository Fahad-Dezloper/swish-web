export type ProviderId = "privacy-cash" | "magicblock-per" | "umbra";

export const DEFAULT_PROVIDER_ID: ProviderId = "privacy-cash";

export function isProviderId(id: string): id is ProviderId {
  return id === "privacy-cash" || id === "magicblock-per" || id === "umbra";
}
