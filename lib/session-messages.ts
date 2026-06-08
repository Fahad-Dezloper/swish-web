import type { ProviderId } from "./providers/types";

export const PC_SESSION_MESSAGE = "Privacy Money account sign in";
export const MB_SESSION_MESSAGE = "Magic Block Swish sign in";
export const UMBRA_SESSION_MESSAGE = "Umbra Privacy Swish sign in";
export const REQUEST_SESSION_MESSAGE = "Swish Request signature";

export function getSessionMessageForProvider(provider: ProviderId): string {
  switch (provider) {
    case "privacy-cash":
      return PC_SESSION_MESSAGE;
    case "magicblock-per":
      return MB_SESSION_MESSAGE;
    case "umbra":
      return UMBRA_SESSION_MESSAGE;
  }
}
