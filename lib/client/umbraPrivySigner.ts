"use client";

import {
  getTransactionDecoder,
  getTransactionEncoder,
} from "@solana/kit";
import {
  SolanaSignMessage,
  SolanaSignTransaction,
} from "@solana/wallet-standard-features";
import type { IUmbraSigner } from "@umbra-privacy/sdk";

export function createUmbraSignerFromPrivyWallet(
  wallet: any,
  account: any
): IUmbraSigner {
  const features = wallet.features;
  const signTx = features[SolanaSignTransaction];
  const signMsg = features[SolanaSignMessage];

  if (!signTx) {
    throw new Error(
      `Wallet "${wallet.name}" does not support solana:signTransaction`
    );
  }
  if (!signMsg) {
    throw new Error(
      `Wallet "${wallet.name}" does not support solana:signMessage`
    );
  }

  const encoder = getTransactionEncoder();
  const decoder = getTransactionDecoder();

  // Privy embedded wallets service signing requests through a single iframe and
  // DEADLOCK when two are in flight at once. The Umbra SDK's eager multi-scheme
  // master-seed setup fires several signMessage calls concurrently (current
  // scheme + v4 legacy scheme), which hangs the embedded wallet forever — only
  // the Twitter/X login path hits this, since injected wallets queue requests
  // internally. Serialize all signing here so at most one request is ever live.
  let signQueue: Promise<unknown> = Promise.resolve();
  function serialize<T>(fn: () => Promise<T>): Promise<T> {
    // Run after the previous request settles (success OR failure), so one
    // rejected sign doesn't wedge the queue.
    const run = signQueue.then(fn, fn);
    signQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  return {
    address: account.address,

    async signTransaction(transaction) {
      return serialize(async () => {
        const wireBytes = encoder.encode(transaction);
        const [output] = await signTx.signTransaction({
          account,
          transaction: wireBytes,
        });
        const decoded = decoder.decode(output.signedTransaction);
        return {
          ...transaction,
          messageBytes: decoded.messageBytes,
          signatures: decoded.signatures,
        } as any;
      });
    },

    async signTransactions(transactions) {
      return serialize(async () => {
        const inputs = transactions.map((tx) => ({
          account,
          transaction: encoder.encode(tx),
        }));
        const outputs = await signTx.signTransaction(...inputs);
        return transactions.map((tx, i) => {
          const decoded = decoder.decode(outputs[i].signedTransaction);
          return {
            ...tx,
            messageBytes: decoded.messageBytes,
            signatures: decoded.signatures,
          } as any;
        });
      });
    },

    async signMessage(message) {
      return serialize(async () => {
        const [output] = await signMsg.signMessage({ account, message });
        return {
          message,
          signature: output.signature,
          signer: account.address,
        };
      });
    },
  } as IUmbraSigner;
}
