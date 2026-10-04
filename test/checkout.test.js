/* Tests for the artist shop checkout validation + handler.
 * Zero dependencies — runs with:  node --test test/
 * The real `stripe` package is never required; a mock client is injected.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildLineItems } = require('../api/_lib');
const checkout = require('../api/checkout');
const createHandler = checkout.createHandler;

const catalog = require('../data/catalog.json');
const config = require('../data/config.json');
const SITE = 'https://example-art-shop.com';

function mockRes() {
  return {
    statusCode: 0, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; }
  };
}

function fakeStripe(capture) {
  return {
    checkout: {
      sessions: {
        create: async function (params) {
          capture.params = params;
          return { id: 'cs_test_123', url: 'https://checkout.stripe.com/pay/cs_test_123' };
        }
      }
    }
  };
}

describe('buildLineItems', function () {
  it('builds correct line items and recomputes prices server-side', function () {
    const { lineItems, totalCents } = buildLineItems(
      [{ artworkId: 'sample-01-dawn-harbor', size: '12x18', qty: 2 }],
      catalog, config, SITE
    );
    assert.equal(lineItems.length, 1);
    assert.equal(lineItems[0].price_data.unit_amount, 8900); // $89 from config, not the client
    assert.equal(lineItems[0].price_data.currency, 'usd');
    assert.equal(lineItems[0].quantity, 2);
    assert.equal(totalCents, 17800);
    assert.match(lineItems[0].price_data.product_data.name, /Dawn Harbor/);
    assert.equal(lineItems[0].price_data.product_data.images[0], SITE + '/art/sample-01.jpg');
  });

  it('ignores any client-supplied price field', function () {
    const { lineItems } = buildLineItems(
      [{ artworkId: 'sample-01-dawn-harbor', size: '8x10', qty: 1, price: 1, unit_amount: 1 }],
      catalog, config, SITE
    );
    assert.equal(lineItems[0].price_data.unit_amount, 4900); // config price wins
  });

  it('rejects unknown artwork ids', function () {
    assert.throws(
      () => buildLineItems([{ artworkId: 'nope', size: '8x10', qty: 1 }], catalog, config, SITE),
      function (e) { return e.statusCode === 400 && /Unknown artwork/.test(e.message); }
    );
  });

  it('rejects unknown print sizes', function () {
    assert.throws(
      () => buildLineItems([{ artworkId: 'sample-01-dawn-harbor', size: '100x100', qty: 1 }], catalog, config, SITE),
      function (e) { return e.statusCode === 400 && /Unknown print size/.test(e.message); }
    );
  });

  it('rejects bad quantities (0, negative, fractional, huge)', function () {
    for (const qty of [0, -1, 1.5, 100, '2']) {
      assert.throws(
        () => buildLineItems([{ artworkId: 'sample-01-dawn-harbor', size: '8x10', qty: qty }], catalog, config, SITE),
        function (e) { return e.statusCode === 400 && /quantity/i.test(e.message); },
        'qty=' + qty
      );
    }
  });

  it('rejects empty / missing carts', function () {
    for (const items of [[], null, undefined, 'nope']) {
      assert.throws(
        () => buildLineItems(items, catalog, config, SITE),
        function (e) { return e.statusCode === 400; }
      );
    }
  });

  it('handles multi-item carts with per-size pricing', function () {
    const { totalCents } = buildLineItems([
      { artworkId: 'sample-01-dawn-harbor', size: '8x10', qty: 1 },   // 4900
      { artworkId: 'sample-04-dusk-towers', size: '24x36', qty: 2 }  // 22900 x 2
    ], catalog, config, SITE);
    assert.equal(totalCents, 4900 + 22900 * 2);
  });
});

describe('checkout handler', function () {
  it('creates a Stripe session and returns its url', async function () {
    const capture = {};
    const handler = createHandler(fakeStripe(capture));
    const res = mockRes();
    await handler(
      { method: 'POST', body: { items: [{ artworkId: 'sample-05-rain-neon', size: '18x24', qty: 1 }] } },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.url, 'https://checkout.stripe.com/pay/cs_test_123');
    const p = capture.params;
    assert.equal(p.mode, 'payment');
    assert.equal(p.line_items[0].price_data.unit_amount, 14900);
    assert.ok(p.shipping_address_collection.allowed_countries.includes('US'));
    assert.match(p.success_url, /\/checkout\/success\//);
    assert.match(p.cancel_url, /\/checkout\/cancel\//);
  });

  it('returns 405 for non-POST', async function () {
    const handler = createHandler(fakeStripe({}));
    const res = mockRes();
    await handler({ method: 'GET' }, res);
    assert.equal(res.statusCode, 405);
  });

  it('returns 400 for an invalid cart without calling Stripe', async function () {
    let called = false;
    const stripe = { checkout: { sessions: { create: async () => { called = true; } } } };
    const handler = createHandler(stripe);
    const res = mockRes();
    await handler(
      { method: 'POST', body: { items: [{ artworkId: 'sample-01-dawn-harbor', size: 'nope', qty: 1 }] } },
      res
    );
    assert.equal(res.statusCode, 400);
    assert.equal(called, false);
  });

  it('returns 500 when Stripe is not configured', async function () {
    const handler = createHandler(null);
    const res = mockRes();
    await handler(
      { method: 'POST', body: { items: [{ artworkId: 'sample-01-dawn-harbor', size: '8x10', qty: 1 }] } },
      res
    );
    assert.equal(res.statusCode, 500);
    assert.match(res.body.error, /not configured/i);
  });

  it('returns 502 when the Stripe API throws', async function () {
    const stripe = { checkout: { sessions: { create: async () => { throw new Error('boom'); } } } };
    const handler = createHandler(stripe);
    const res = mockRes();
    await handler(
      { method: 'POST', body: { items: [{ artworkId: 'sample-01-dawn-harbor', size: '8x10', qty: 1 }] } },
      res
    );
    assert.equal(res.statusCode, 502);
  });
});
