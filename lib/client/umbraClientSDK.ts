"use client";

import { getUmbraClient, assertMasterSeed } from "@umbra-privacy/sdk";
import type { IUmbraClient, IUmbraSigner } from "@umbra-privacy/sdk/interfaces";
import type { MasterSeed } from "@umbra-privacy/sdk/types";
import {
  getCdnZkAssetProvider,
  getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver,
  getClaimSelfClaimableUtxoIntoEncryptedBalanceProver,
  getClaimSelfClaimableUtxoIntoPublicBalanceProver,
  getCreateReceiverClaimableUtxoFromPublicBalanceProver,
  getCreateSelfClaimableUtxoFromPublicBalanceProver,
  getUserRegistrationProver,
} from "@umbra-privacy/web-zk-prover";
import type {
  IZkProverForReceiverClaimableUtxo,
  IZkProverForSelfClaimableUtxo,
  IZkProverSuite,
} from "@umbra-privacy/sdk/interfaces";

const UMBRA_INDEXER = "https://utxo-indexer.api.umbraprivacy.com";

let cachedSuite: IZkProverSuite | null = null;

export function getBrowserUmbraProverSuite(): IZkProverSuite {
  if (cachedSuite) return cachedSuite;

  const assetProvider = getCdnZkAssetProvider();
  const deps = { assetProvider };

  const suite: IZkProverSuite = {
    registration: getUserRegistrationProver(deps),
    utxoSelfClaimable: getCreateSelfClaimableUtxoFromPublicBalanceProver(
      deps
    ) as unknown as IZkProverForSelfClaimableUtxo,
    utxoReceiverClaimable: getCreateReceiverClaimableUtxoFromPublicBalanceProver(
      deps
    ) as unknown as IZkProverForReceiverClaimableUtxo,
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

export interface BrowserUmbraClientArgs {
  signer: IUmbraSigner;
  rpcUrl: string;
  // Defaults to deferred (lazy master seed signing) — recommended.
  deferMasterSeedSignature?: boolean;
}

let cachedClient: {
  address: string;
  client: Promise<IUmbraClient>;
} | null = null;

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
  const masterSeedStorage = makeSessionStorageMasterSeedStorage(
    args.signer.address
  );
  const promise = getUmbraClient(
    {
      signer: args.signer,
      network: "mainnet",
      rpcUrl: args.rpcUrl,
      rpcSubscriptionsUrl: wsUrl,
      indexerApiEndpoint: UMBRA_INDEXER,
      deferMasterSeedSignature: args.deferMasterSeedSignature ?? true,
    },
    { masterSeedStorage }
  );
  cachedClient = { address: args.signer.address, client: promise };
  return promise;
}

export function clearBrowserUmbraClientCache() {
  cachedClient = null;
}

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
