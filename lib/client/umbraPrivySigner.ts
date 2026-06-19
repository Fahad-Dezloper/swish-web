"use client";

import {
  getTransactionDecoder,
  getTransactionEncoder,
} from "@solana/kit";
import {
  SolanaSignMessage,
  SolanaSignTransaction,
} from "@solana/wallet-standard-features";
import type { IUmbraSigner } from "@umbra-privacy/sdk/interfaces";

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

  return {
    address: account.address,

    async signTransaction(transaction) {
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
    },

    async signTransactions(transactions) {
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
    },

    async signMessage(message) {
      const [output] = await signMsg.signMessage({ account, message });
      return {
        message,
        signature: output.signature,
        signer: account.address,
      };
    },
  } as IUmbraSigner;
}
