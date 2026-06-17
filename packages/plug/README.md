# @swishdotcash/plug

**The Plug** — a drop-in widget for private USDC payments on Solana, powered by [Swish](https://swish.cash). One component, private payments, no protocol plumbing.

> v1 is **Pay** only: one recipient, one amount, USDC. Non-custodial — the payer's connected wallet signs and pays its own gas. Swish auto-routes over its privacy rails (MagicBlock / Privacy Cash today; Umbra slots in transparently).

## React

```bash
npm i @swishdotcash/plug
```

```tsx
import { Plug } from "@swishdotcash/plug";

<Plug
  recipient="merchant.sol"        // Solana address OR Swish @handle
  amount={25.0}                   // optional — omit to let the payer type it
  reference="order_1234"          // optional — your order id, echoed back on success
  onSuccess={(txSignature, reference) => markOrderPaid(reference)}
  onError={(message) => console.error(message)}
  onClose={() => {}}
/>;
```

## Plain HTML (no build step)

```html
<script src="https://plug.swish.cash/plug.js"></script>
<script>
  Plug.open({
    recipient: "merchant.sol",
    amount: 25.0,
    reference: "order_1234",
    onSuccess: (txSignature, reference) => markOrderPaid(reference),
  });
</script>
```

## How it works

`<Plug />` renders a branded **"Deposit Privately"** button (auto-shrinks to
"Deposit" when cramped). Clicking it opens the hosted widget (`plug.swish.cash/plug`)
in a modal iframe and relays its events over `postMessage`. The iframe only
loads on click. All wallet + protocol logic stays in the hosted route, so this
package bundles **no** Solana or wallet dependencies — `react` is the only peer
dependency.

Bring your own trigger by passing `children`:

```tsx
<Plug recipient="merchant.sol" amount={25}>
  <button className="my-checkout-btn">Pay now</button>
</Plug>
```

In plain HTML, the button is injected for you — either declaratively…

```html
<div data-swish-plug data-recipient="merchant.sol" data-amount="25"></div>
```

…or imperatively with `Plug.mount("#slot", { ...opts })` (callbacks supported).

The same hosted route doubles as a **redirect / hosted-checkout** target (pass a
`returnUrl`) for surfaces where an iframe isn't available (e.g. mobile webviews).

## Props

| Prop        | Type                                            | Notes                                            |
| ----------- | ----------------------------------------------- | ------------------------------------------------ |
| `recipient` | `string`                                        | Solana address or Swish `@handle`. Omit to let the payer enter it. |
| `amount`    | `number`                                        | USDC. If set, the field is locked.               |
| `token`     | `"USDC"`                                        | v1 supports USDC only.                           |
| `reference` | `string`                                        | Optional. Your own order id, echoed back verbatim in `onSuccess`. Omit if you have no order to track. |
| `baseUrl`   | `string`                                        | Hosted Plug origin. Defaults to `plug.swish.cash`. |
| `label`     | `string`                                        | Override button text. Defaults to "Deposit Privately". |
| `compact`   | `boolean`                                       | Force the short "Deposit" label.                 |
| `children`  | `ReactNode`                                     | Custom trigger element (replaces the button).    |
| `onSuccess` | `(txSignature: string, reference?) => void`     | Payment confirmed.                               |
| `onError`   | `(message: string) => void`                     | Payment failed (widget stays open for retry).    |
| `onClose`   | `() => void`                                     | User dismissed the widget.                       |
