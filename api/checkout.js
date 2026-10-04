/* Artist shop template — Stripe Checkout session creator (Vercel serverless function).
 *
 * POST /api/checkout  { items: [{ artworkId, size, qty }] }
 *   -> 200 { url }            (redirect the browser to Stripe Checkout)
 *   -> 4xx { error }          (invalid cart)
 *   -> 500 { error }          (Stripe not configured)
 *
 * Prices are recomputed server-side from data/config.json — the client
 * never sends prices. Uses inline price_data, so no Stripe products need
 * to exist in the dashboard.
 *
 * Env vars: STRIPE_SECRET_KEY (required), SITE_URL (optional; falls back
 * to VERCEL_URL, then config.siteUrl).
 */
'use strict';

const { buildLineItems, getSiteUrl } = require('./_lib');
const catalog = require('../data/catalog.json');
const config = require('../data/config.json');

const ALLOWED_COUNTRIES = ['US', 'CA', 'GB', 'IE', 'AU', 'NZ', 'DE', 'FR', 'NL', 'BE', 'ES', 'IT', 'PT', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'JP'];

function createHandler(stripeClient) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    let items = req.body && req.body.items;
    if (typeof req.body === 'string') {
      try { items = JSON.parse(req.body).items; } catch (e) { items = undefined; }
    }

    let lineItems, summary;
    try {
      const built = buildLineItems(items, catalog, config, getSiteUrl(config));
      lineItems = built.lineItems;
      summary = built.summary;
    } catch (e) {
      return res.status(e.statusCode || 400).json({ error: e.message });
    }

    if (!stripeClient) {
      return res.status(500).json({
        error: 'Checkout is not configured yet (missing STRIPE_SECRET_KEY). The gallery owner has been notified.'
      });
    }

    const siteUrl = getSiteUrl(config);
    try {
      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: lineItems,
        shipping_address_collection: { allowed_countries: ALLOWED_COUNTRIES },
        billing_address_collection: 'required',
        success_url: siteUrl + '/checkout/success/?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: siteUrl + '/checkout/cancel/',
        metadata: { items: summary, store: config.siteName }
      });
      return res.status(200).json({ url: session.url });
    } catch (e) {
      console.error('Stripe session creation failed:', e && e.message);
      return res.status(502).json({ error: 'Could not start checkout. Please try again.' });
    }
  };
}

// Lazily create the Stripe client so tests can require this module without
// the `stripe` package installed or a key present.
let stripe = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
} catch (e) {
  stripe = null;
}

const handler = createHandler(stripe);
handler.createHandler = createHandler; // exposed for tests
module.exports = handler;
