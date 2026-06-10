"use client";

/**
 * Browser-side Umbra SDK helpers — counterpart to lib/sponsor/umbraSDK.ts
 * (server-side). These are safe to import from "use client" components
 * and run in the browser bundle.
 *
 * Used by useUmbraSend, useUmbraRegister, etc. For the architecture
 * decision behind running Umbra client-side for direct Send / Request
 * fulfill, see [Umbra pivot](memory/project_umbra_pivot_to_client_side.md).
 */

import {
  getUmbraClient,
  getCdnZkAssetProvider,
  getDefaultZkProverDeps,
  getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver,
  getClaimSelfClaimableUtxoIntoEncryptedBalanceProver,
  getClaimSelfClaimableUtxoIntoPublicBalanceProver,
  getATAIntoStealthPoolNoteCreatorProver,
  getETAIntoStealthPoolNoteCreatorProver,
  getUserRegistrationProver,
} from "@umbra-privacy/sdk";
import type {
  IUmbraClient,
  IUmbraSigner,
  MasterSeed,
} from "@umbra-privacy/sdk";
import type { IZkProverSuite } from "@umbra-privacy/sdk/shared";
import type { IZkProverForATAIntoStealthPoolNote } from "@umbra-privacy/sdk/deposit";
import { assertMasterSeed } from "@umbra-privacy/sdk/types";
// Load-bearing: needed to scan pre-migration notes (encrypted to the v4 MVK).
// See the getUmbraClient call below for the full rationale.
import { masterSeedSchemeV4 } from "@umbra-privacy/sdk/master-seed-schemes";

const UMBRA_INDEXER = "https://utxo-indexer.api.umbraprivacy.com";

// Cached suite — circuit asset providers can be reused across all
// browser-side SDK calls within the same page session.
let cachedSuite: IZkProverSuite | null = null;

export function getBrowserUmbraProverSuite(): IZkProverSuite {
  if (cachedSuite) return cachedSuite;

  // v5: provers ship from the SDK (snarkjs-backed) and take the full
  // ZkProverDeps bag. See lib/sponsor/umbraSDK.ts for the suite-shape change
  // (the two v4 create-UTXO slots collapsed into etaIntoStealthPoolNoteCreator).
  const deps = {
    ...getDefaultZkProverDeps(),
    assetProvider: getCdnZkAssetProvider(),
  };

  const suite: IZkProverSuite = {
    registration: getUserRegistrationProver(deps),
    etaIntoStealthPoolNoteCreator: getETAIntoStealthPoolNoteCreatorProver(deps),
    claimSelfClaimableIntoEncryptedBalance:
      getClaimSelfClaimableUtxoIntoEncryptedBalanceProver(deps),
    claimReceiverClaimableIntoEncryptedBalance:
      getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver(deps),
    claimSelfClaimableIntoPublicBalance:
      getClaimSelfClaimableUtxoIntoPublicBalanceProver(deps),
  };
  cachedSuite = suite;
  return suite;
}

// ATA (public-balance) deposit prover — not part of IZkProverSuite (which only
// carries the ETA creator). Direct Send / Request fulfill deposit public USDC,
// so those flows need this. See lib/sponsor/umbraSDK.ts for the server twin.
let cachedAtaProver: IZkProverForATAIntoStealthPoolNote | null = null;

export function getBrowserUmbraAtaDepositProver(): IZkProverForATAIntoStealthPoolNote {
  if (cachedAtaProver) return cachedAtaProver;
  const deps = {
    ...getDefaultZkProverDeps(),
    assetProvider: getCdnZkAssetProvider(),
  };
  cachedAtaProver = getATAIntoStealthPoolNoteCreatorProver(deps);
  return cachedAtaProver;
}

export interface BrowserUmbraClientArgs {
  signer: IUmbraSigner;
  rpcUrl: string;
  // Defaults to deferred (lazy master seed signing) — recommended.
  deferMasterSeedSignature?: boolean;
}

// Per-address client cache. The Umbra client caches master seed
// internally (after first derivation), so reusing the same client
// across sends in the same browser session avoids re-prompting for
// the consent signMessage on every send. Keyed by signer address so
// switching wallets invalidates the cache.
let cachedClient: {
  address: string;
  client: Promise<IUmbraClient>;
} | null = null;

// SessionStorage-backed master seed persistence. Survives page refresh
// within the same browser tab; cleared on tab close or logout. Keyed by
// wallet address so different wallets don't share keys.
//
// Trust model: same as PC's session sig today. The master seed is
// sensitive but sessionStorage is per-tab + cleared on close, which is
// acceptable for v1. For higher security, consider encrypting at rest
// with a wallet-derived key (one extra signMessage per session).

const SESSION_STORAGE_PREFIX = "umbra_master_seed:";

function masterSeedStorageKey(address: string): string {
  return `${SESSION_STORAGE_PREFIX}${address}`;
}

function makeSessionStorageMasterSeedStorage(address: string) {
  return {
    load: async () => {
      if (typeof window === "undefined") {
        return { exists: false } as const;
      }
      const stored = sessionStorage.getItem(masterSeedStorageKey(address));
      if (!stored) return { exists: false } as const;
      try {
        const bytes = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
        if (bytes.length !== 64) return { exists: false } as const;
        const seed = bytes as unknown as MasterSeed;
        assertMasterSeed(seed);
        return { exists: true, seed } as const;
      } catch {
        // Corrupt entry — clear it.
        sessionStorage.removeItem(masterSeedStorageKey(address));
        return { exists: false } as const;
      }
    },
    store: async (seed: MasterSeed) => {
      if (typeof window === "undefined") {
        return { success: false, error: "no window" } as const;
      }
      const bytes = seed as unknown as Uint8Array;
      const b64 = btoa(String.fromCharCode(...bytes));
      sessionStorage.setItem(masterSeedStorageKey(address), b64);
      return { success: true } as const;
    },
  };
}

export function clearStoredMasterSeed(address: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(masterSeedStorageKey(address));
}

/**
 * Check whether a master seed is already cached for a given address.
 * Used by `useUmbraBalance` to decide whether to auto-fetch (silent) vs
 * wait for the user to click "Reveal" — keeps profile loads from
 * surprising users with a wallet popup on a fresh session.
 */
export function hasStoredMasterSeed(address: string): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(masterSeedStorageKey(address)) !== null;
}

export async function getBrowserUmbraClient(
  args: BrowserUmbraClientArgs
): Promise<IUmbraClient> {
  if (cachedClient?.address === args.signer.address) {
    return cachedClient.client;
  }
  const wsUrl = args.rpcUrl.replace(/^https?:\/\//, "wss://");
  // legacyMasterSeedSchemes + eager are LOAD-BEARING, not optional. v4-era
  // accounts hold incoming notes encrypted to the old V4-derived MVK; the
  // on-chain RESTORE flow re-registers the MVK but does NOT migrate those old
  // notes' encryption, so the current-scheme scanner returns 0 for them.
  // Passing the v4 scheme (and `eager`, so the SDK actually signs the v4
  // message and derives the v4 MVK up front) is the only way to scan/read
  // pre-migration notes. Verified by bisect 2026-06-11: removing this made a
  // restored wallet's funds read as 0. Cost: an extra consent sign. Keep until
  // a wallet's pre-migration notes are all claimed out. (Must be V4 ALONE —
  // V2/V3/V4 share a consent message, so listing several is ambiguous.)
  // We also don't pass our sessionStorage masterSeedStorage; the per-address
  // `cachedClient` already avoids re-prompting within a session.
  const promise = getUmbraClient({
    signer: args.signer,
    network: "mainnet",
    rpcUrl: args.rpcUrl,
    rpcSubscriptionsUrl: wsUrl,
    indexerApiEndpoint: UMBRA_INDEXER,
    deferMasterSeedSignature: args.deferMasterSeedSignature ?? true,
    legacyMasterSeedSchemes: [masterSeedSchemeV4],
    signSchemeMessages: "eager",
  });
  cachedClient = { address: args.signer.address, client: promise };
  return promise;
}

// Clear the cached client — call on wallet disconnect / logout.
export function clearBrowserUmbraClientCache() {
  cachedClient = null;
}

// Cached Umbra relayer instance for browser. Used by claim flows
// (claimable UTXO → encrypted balance) which require relayer-submitted
// transactions.
let cachedRelayer: any | null = null;

export async function getBrowserUmbraRelayer() {
  if (cachedRelayer) return cachedRelayer;
  const { getUmbraRelayer } = await import("@umbra-privacy/sdk");
  const apiEndpoint =
    process.env.NEXT_PUBLIC_UMBRA_RELAYER_URL ||
    "https://relayer.api.umbraprivacy.com";
  cachedRelayer = getUmbraRelayer({ apiEndpoint });
  return cachedRelayer;
}
