/**
 * Server-side Umbra SDK helpers.
 *
 * - `getUmbraProverSuite` constructs the IZkProverSuite from the v5 SDK's
 *   snarkjs-backed prover factories, with circuit assets fetched from a CDN.
 * - `createUmbraSignerFromKeypair` adapts a web3.js Keypair to IUmbraSigner
 *   for the burner-pattern flows where Swish controls the keys.
 * - `getServerUmbraClient` is the entry point — wraps `getUmbraClient` with
 *   our RPC + indexer config and the prover suite.
 *
 * See [Umbra research](memory/project_protocol_umbra.md) and
 * [Unified balance vision](memory/project_unified_balance_vision.md).
 */

import { Keypair } from "@solana/web3.js";
import {
  createSignerFromPrivateKeyBytes,
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
  Network,
} from "@umbra-privacy/sdk";
import type { IZkProverSuite } from "@umbra-privacy/sdk/shared";
import type { IZkProverForATAIntoStealthPoolNote } from "@umbra-privacy/sdk/deposit";

const UMBRA_NETWORK: Network = "mainnet";
const UMBRA_INDEXER = "https://utxo-indexer.api.umbraprivacy.com";

function getRpcUrl(): string {
  const url = process.env.RPC_URL;
  if (!url) {
    throw new Error("RPC_URL not configured");
  }
  return url;
}

// Most providers serve the WS endpoint at the same host with `wss://`. Override
// via `RPC_WSS_URL` if a provider needs a different host.
function getRpcSubscriptionsUrl(): string {
  const explicit = process.env.RPC_WSS_URL;
  if (explicit) return explicit;
  return getRpcUrl().replace(/^https?:\/\//, "wss://");
}

// Cache the suite — circuit asset providers can be reused across requests, no
// per-request state.
let cachedSuite: IZkProverSuite | null = null;

export function getUmbraProverSuite(): IZkProverSuite {
  if (cachedSuite) return cachedSuite;

  // v5 provers ship from the SDK itself (snarkjs-backed) and take the full
  // ZkProverDeps bag — `getDefaultZkProverDeps()` supplies clock/logger/fetch,
  // we add the CDN asset provider for circuit downloads.
  const deps = {
    ...getDefaultZkProverDeps(),
    assetProvider: getCdnZkAssetProvider(),
  };

  // v5 collapsed the two v4 create-UTXO slots (self/receiver claimable) into a
  // single `etaIntoStealthPoolNoteCreator` shared by both flows, so the old
  // variance casts are gone.
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

// The ATA (public-balance) deposit prover is NOT part of IZkProverSuite — the
// suite only carries the ETA (confidential) creator. v1 deposits move public
// USDC into the pool, so the burner-deposit functions need this ATA prover.
let cachedAtaProver: IZkProverForATAIntoStealthPoolNote | null = null;

export function getUmbraAtaDepositProver(): IZkProverForATAIntoStealthPoolNote {
  if (cachedAtaProver) return cachedAtaProver;
  const deps = {
    ...getDefaultZkProverDeps(),
    assetProvider: getCdnZkAssetProvider(),
  };
  cachedAtaProver = getATAIntoStealthPoolNoteCreatorProver(deps);
  return cachedAtaProver;
}

// web3.js Keypair `secretKey` is 64 bytes (32-byte seed + 32-byte pubkey),
// which `createSignerFromPrivateKeyBytes` accepts directly.
export async function createUmbraSignerFromKeypair(
  keypair: Keypair
): Promise<IUmbraSigner> {
  return createSignerFromPrivateKeyBytes(keypair.secretKey);
}

interface ServerUmbraClientArgs {
  signer: IUmbraSigner;
  // Default `true`: master seed derivation is lazy. The signer's `signMessage`
  // is invoked at most once across the client's lifetime, when a service
  // function actually needs a derived key. Burner flows want this lazy because
  // we may not need every key immediately.
  deferMasterSeedSignature?: boolean;
}

export async function getServerUmbraClient(
  args: ServerUmbraClientArgs
): Promise<IUmbraClient> {
  return getUmbraClient({
    signer: args.signer,
    network: UMBRA_NETWORK,
    rpcUrl: getRpcUrl(),
    rpcSubscriptionsUrl: getRpcSubscriptionsUrl(),
    indexerApiEndpoint: UMBRA_INDEXER,
    deferMasterSeedSignature: args.deferMasterSeedSignature ?? true,
  });
}
