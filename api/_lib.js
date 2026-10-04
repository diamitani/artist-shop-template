/* Shared checkout logic for the artist shop template.
 * Pure Node, no dependencies — safe to require from tests.
 * Prices are ALWAYS recomputed from data/config.json; client-supplied
 * prices are never trusted (they are not even accepted as input).
 */
'use strict';

function bad(statusCode, message) {
  const e = new Error(message);
  e.statusCode = statusCode;
  return e;
}

/**
 * Validate cart items and build Stripe line_items.
 * items: [{artworkId, size, qty}]
 * Returns { lineItems, summary } where summary is safe to store in metadata.
 * Throws an Error with .statusCode on invalid input.
 */
function buildLineItems(items, catalog, config, siteUrl) {
  if (!Array.isArray(items) || items.length === 0) {
    throw bad(400, 'Your cart is empty.');
  }
  if (items.length > 50) {
    throw bad(400, 'Too many items in cart.');
  }

  const artworks = {};
  catalog.artworks.forEach(function (a) { artworks[a.id] = a; });
  const sizes = {};
  config.printSizes.forEach(function (s) { sizes[s.id] = s; });
  const base = String(siteUrl || config.siteUrl || '').replace(/\/$/, '');

  const lineItems = items.map(function (it, i) {
    const art = artworks[it.artworkId];
    if (!art) throw bad(400, 'Unknown artwork: ' + String(it.artworkId).slice(0, 60));
    const size = sizes[it.size];
    if (!size) throw bad(400, 'Unknown print size: ' + String(it.size).slice(0, 40));
    const qty = it.qty;
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw bad(400, 'Invalid quantity for item ' + (i + 1) + '.');
    }
    // Server-side price — the client never sends a price.
    const unitAmount = Math.round(size.price * 100);
    if (!(unitAmount > 0)) throw bad(500, 'Misconfigured price for size ' + size.id + '.');

    return {
      price_data: {
        currency: (config.currency || 'USD').toLowerCase(),
        unit_amount: unitAmount,
        product_data: {
          name: art.title + ' — ' + size.label + ' print',
          description: art.style + ' · ' + (config.editionInfo || 'Archival giclée print'),
          images: base ? [base + '/art/' + art.image] : [],
          metadata: { artworkId: art.id, size: size.id }
        }
      },
      quantity: qty
    };
  });

  const totalCents = lineItems.reduce(function (sum, li) {
    return sum + li.price_data.unit_amount * li.quantity;
  }, 0);

  const summary = items.map(function (it) {
    return it.artworkId + ':' + it.size + 'x' + it.qty;
  }).join(',').slice(0, 400);

  return { lineItems: lineItems, totalCents: totalCents, summary: summary };
}

function getSiteUrl(config) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return 'https://' + process.env.VERCEL_URL;
  return (config.siteUrl || '').replace(/\/$/, '');
}

module.exports = { buildLineItems: buildLineItems, getSiteUrl: getSiteUrl };
