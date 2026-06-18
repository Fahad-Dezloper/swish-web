# @swishdotcash/plug

**The Plug** — a drop-in widget for private USDC payments on Solana, powered by [Swish](https://swish.cash). One component, private payments, no protocol plumbing.

The payer connects their own wallet, pays from it, and the transfer is routed over Swish's privacy rails automatically. You get a single `onSuccess` callback with the transaction signature and your order reference — everything you need to mark an order paid.

```tsx
<Plug recipient="9xQ…aB3" amount={25} reference="order_1234"
      onSuccess={(sig, ref) => markOrderPaid(ref)} />
```

> **v1 scope — Pay only.** One recipient, one amount, USDC. Non-custodial: the
> payer's connected wallet signs and pays its own gas. Swish auto-routes over its
> privacy rails (MagicBlock / Privacy Cash today; more slot in transparently with
> no integration change).

---

## Install

```bash
npm i @swishdotcash/plug
# or: pnpm add @swishdotcash/plug   /   yarn add @swishdotcash/plug
```

`react` and `react-dom` (>= 17) are peer dependencies. **No** Solana or wallet
libraries are bundled — all of that lives in the hosted widget (see
[How it works](#how-it-works)).

No build step? Use the [script tag](#plain-html-no-build-step) instead.

---

## Quick start — React

```tsx
import { Plug } from "@swishdotcash/plug";

export function Checkout() {
  return (
    <Plug
      recipient="9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin" // Solana address
      amount={25.0}              // optional — omit to let the payer enter it
      reference="order_1234"     // optional — your order id, echoed back on success
      onSuccess={(txSignature, reference) => {
        markOrderPaid(reference);
      }}
      onError={(message) => console.error(message)}
      onClose={() => {}}
    />
  );
}
```

`<Plug />` renders a branded **"Deposit Privately"** button. Clicking it opens the
hosted widget in a modal; the payer connects a wallet, reviews, and pays. The
iframe only loads on click.

---

## Quick start — Plain HTML (no build step)

```html
<script src="https://plug.swish.cash/plug.js"></script>
<script>
  Plug.open({
    recipient: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    amount: 25.0,
    reference: "order_1234",
    onSuccess: function (txSignature, reference) {
      markOrderPaid(reference);
    },
  });
</script>
```

Three ways to use the script tag:

- **`Plug.open(options)`** — open the widget immediately (e.g. from your own button's click handler).
- **`Plug.mount(target, options)`** — render the branded button into an element (`target` is a selector string or element).
- **Declarative auto-init** — drop a marker element and the button is injected for you:
  ```html
  <div
    data-swish-plug
    data-recipient="9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"
    data-amount="25"
    data-reference="order_1234"
  ></div>
  ```
  Supported attributes: `data-recipient`, `data-amount`, `data-reference`,
  `data-label`, `data-base-url`. For callbacks, use `Plug.mount`/`Plug.open`.

---

## Configuration

| Option      | Type                                        | Required | Default              | Notes |
| ----------- | ------------------------------------------- | -------- | -------------------- | ----- |
| `recipient` | `string`                                    | No¹      | —                    | The destination **Solana address**. Omit to let the payer enter it in the widget. *(v1 takes a raw address only — `@handle` resolution is a planned fast-follow.)* |
| `amount`    | `number`                                    | No¹      | —                    | Amount in USDC. If set, the amount field is **locked**; omit to let the payer type it. |
| `token`     | `"USDC"`                                    | No       | `"USDC"`             | v1 supports USDC only. |
| `reference` | `string`                                    | No       | —                    | Your own order/correlation id (order number, invoice id, cart id). Never read or stored — echoed back **verbatim** in `onSuccess`. See [Matching payments to orders](#matching-payments-to-orders). |
| `returnUrl` | `string`                                    | No       | —                    | **Hosted-checkout / redirect mode only** (script tag or direct URL). When set, on success the widget redirects the top window to this URL. See [Hosted checkout](#hosted-checkout--redirect-mode). |
| `baseUrl`   | `string`                                    | No       | `https://plug.swish.cash` | Origin of the hosted Plug. Override only for self-hosting/testing. |
| `label`     | `string`                                    | No       | `"Deposit Privately"`| Override the trigger-button text. |
| `compact`   | `boolean`                                   | No       | auto                 | Force the short `"Deposit"` label. If unset, the button auto-shrinks when cramped (< ~150px). |
| `children`  | `ReactNode`                                 | No       | —                    | **(React)** Custom trigger element — replaces the default button. See [Custom trigger](#custom-trigger). |
| `className` | `string`                                    | No       | —                    | **(React)** Extra class on the iframe wrapper. |
| `style`     | `CSSProperties`                             | No       | —                    | **(React)** Inline style on the iframe wrapper. |

¹ Both `recipient` and `amount` are optional. Anything you omit becomes a field
the payer fills in. Preset both for a fixed checkout; preset neither for an
open-ended "pay me privately" form.

### Callbacks

| Callback    | Signature                                            | Fires when |
| ----------- | ---------------------------------------------------- | ---------- |
| `onSuccess` | `(txSignature: string, reference?: string) => void`  | The payment confirms on-chain. `txSignature` is the Solana transaction signature; `reference` is your value passed back untouched. |
| `onError`   | `(message: string) => void`                          | The payment fails. The widget stays open showing an error + **Try Again**. |
| `onClose`   | `() => void`                                          | The payer dismisses the widget (clicks ✕, "Done", or outside the modal). |

`onSuccess` fires the moment the transaction confirms — independently of whether
the payer has dismissed the success screen — so it's safe to use for marking
orders paid.

---

## Matching payments to orders

Pass your order id as `reference`. It's echoed back in `onSuccess`, so you can
reconcile the on-chain payment with your system:

```tsx
<Plug
  recipient={MERCHANT_ADDRESS}
  amount={cart.total}
  reference={order.id}
  onSuccess={(txSignature, reference) => {
    // reference === order.id
    fulfillOrder(reference, txSignature);
  }}
/>
```

The Plug never reads, stores, or transmits the `reference` anywhere except back
to your own callback — it's opaque correlation data.

---

## Hosted checkout / redirect mode

For surfaces where an iframe isn't available (mobile webviews, some in-app
browsers), use the same hosted route as a **redirect target**. Pass a `returnUrl`
(via the script tag or by linking directly to the hosted URL). On success the
widget redirects the **top window** to:

```
{returnUrl}?status=success&signature={txSignature}&reference={reference}
```

```js
Plug.open({
  recipient: MERCHANT_ADDRESS,
  amount: 25,
  reference: "order_1234",
  returnUrl: "https://shop.example.com/thanks",
});
```

Verify the payment server-side from the returned `signature` before fulfilling.

---

## Custom trigger

**React** — pass `children` to replace the default button with your own:

```tsx
<Plug recipient={MERCHANT_ADDRESS} amount={25}>
  <button className="my-checkout-btn">Pay privately</button>
</Plug>
```

**Script tag** — bind your own element via `Plug.mount` or call `Plug.open` from
any click handler.

---

## How it works

`<Plug />` (and `plug.js`) is a thin wrapper around a **hosted iframe**
(`plug.swish.cash/plug`). The component renders a trigger and, on click, opens the
hosted widget in a modal and relays its events to your callbacks over
`postMessage` (origin-checked).

All wallet connection and protocol logic lives in the hosted route — which is why
this package bundles **no** Solana/wallet dependencies and has `react` as its only
peer dependency. The widget is served from its own origin (`plug.swish.cash`), so
it carries no session from, and leaks nothing to, your page.

The widget stays open on success to show a confirmation (with a link to the
transaction); the payer dismisses it with **Done**. Your `onSuccess` has already
fired by then.

---

## What the payer needs

The Plug is **non-custodial** and provisions nothing on the payer's behalf, so the
payer must:

- have a **Solana wallet** they can connect (Phantom, Solflare, etc. via wallet-connect), and
- hold **USDC** to send **plus a little SOL** for gas.

There's no Swish account or sign-up — they connect, pay, done.

---

## Routing & privacy

Swish auto-routes each payment over its privacy rails (today: MagicBlock and
Privacy Cash) and picks the route for you — the payer signs once. The chosen rail
is shown in the widget's breakdown. Additional rails can be added later with **no
change to your integration**.

---

## Requirements

- A modern browser with iframe + `postMessage` support.
- React >= 17 (React SDK only).
- Ships ESM + CJS builds and TypeScript type definitions.

---

## Links

- Website: <https://swish.cash>
- Playground & docs: <https://plug.swish.cash>

## License

MIT
