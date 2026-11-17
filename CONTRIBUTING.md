# Contributing to Sahlify

## Adding an Algerian Delivery Carrier

### Case 1: Ecotrack-based carrier (most common)
If the carrier uses Ecotrack, you do **not** need to write an adapter. Add a row to `backend/src/db/seeds/carriers.js`:

```js
{
  code: "carrier_slug",
  name: "Carrier Display Name",
  platform: "ecotrack",
  base_url: "https://carrier.ecotrack.dz",
  credential_fields: ["api_token"],
  supports_webhook: false,
  supports_stopdesk: true,
}
```

### Case 2: New standalone carrier platform
1. Create `backend/src/modules/shipping/adapters/<platform>.js` implementing:
   - `validateCredentials(creds, carrier)`
   - `createShipment(order, creds, carrier)`
   - `getStatuses(trackingNumbers, creds, carrier)`
   - `cancelShipment(trackingNumber, creds, carrier)`
   - `parseWebhook(body, carrier)` (or `() => null`)
   - `mapStatus(rawStatus)`
2. Register the adapter in `backend/src/modules/shipping/adapters/index.js`.
3. Add the carrier entry to `backend/src/db/seeds/carriers.js`.
4. Add a test in `backend/tests/`.
