import type { ScannedStealthPoolNoteResult } from "@umbra-privacy/sdk/burn";

/**
 * A burnable stealth-pool note as returned by the v5 scanner. Carries the
 * `treeIndex`/`insertionIndex` the claimed-utxo tracker keys on, plus `amount`.
 */
export type BurnableNote =
  ScannedStealthPoolNoteResult["etaToStealthPoolReceiverBurnable"][number];

/**
 * Split a v5 scan result into the receiver-claimable and self-claimable note
 * sets, flattening ALL THREE source variants per side:
 *   - `eta*`            — from an Encrypted Token Account
 *   - `ata*`            — from a public Associated Token Account
 *   - `networkBalance*` — sender paid out of their confidential / network balance
 *
 * Missing the `networkBalance*` buckets makes incoming notes from
 * confidential-balance senders invisible AND unclaimable (they never enter the
 * balance total and the claim/unlock flows find nothing). Keep all three.
 *
 * Typed against `ScannedStealthPoolNoteResult`, so a future SDK bucket rename is
 * a COMPILE error here (one place) instead of a silent `[]` at every call site —
 * the exact silent-stuck-balance class this migration is meant to leave behind.
 */
export function splitBurnableNotes(scan: ScannedStealthPoolNoteResult): {
  receiver: BurnableNote[];
  self: BurnableNote[];
} {
  return {
    receiver: [
      ...scan.etaToStealthPoolReceiverBurnable,
      ...scan.ataToStealthPoolReceiverBurnable,
      ...scan.networkBalanceToStealthPoolReceiverBurnableWithEncryptedAddress,
    ],
    self: [
      ...scan.etaToStealthPoolSelfBurnable,
      ...scan.ataToStealthPoolSelfBurnable,
      ...scan.networkBalanceToStealthPoolSelfBurnableWithEncryptedAddress,
    ],
  };
}
