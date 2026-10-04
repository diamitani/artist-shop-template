# Artist Shop Template — gallery portfolio + fine-art print shop

A reusable, gallery-grade portfolio and print store for any artist. The demo ships with a
fictional sample artist, **Maya Rivers** ([@mayarivers.art](https://instagram.com/mayarivers.art)),
two sample exhibits, and six sample artworks — swap in your own identity, images, and prices
and it's your store.

**How it works:** a pure-Node build script reads `data/catalog.json` + `data/config.json`
and emits a fully static site into `dist/`. Works are organized into **exhibits** (curated
collections). The cart is vanilla JS + localStorage with a slide-over drawer on every page.
Checkout is a Vercel serverless function that creates a Stripe Checkout Session — prices are
**recomputed server-side**, never trusted from the client. No frameworks, no build
dependencies, no database.

## Project structure

```
artist-shop-template/
├── data/
│   ├── catalog.json      # exhibits[] + artworks[] — the whole gallery lives here
│   └── config.json       # site name, artist, email, instagram, hero text, print sizes + prices
├── public/art/           # artwork JPEGs (+ thumbs/ — 900px thumbnails for cards)
├── src/assets/css/       # style.css — the gallery design system
├── src/assets/js/        # shop.js — cart drawer, buy box, checkout redirect
├── scripts/
│   ├── build.js          # static site generator (pure Node, zero deps)
│   ├── templates.js      # HTML layout + card templates
│   ├── check-links.js    # dead-link checker over dist/
│   └── serve.js          # tiny local static server for previews
├── api/
│   ├── checkout.js       # Vercel serverless fn: POST /api/checkout -> Stripe session
│   └── _lib.js           # shared validation + line-item builder (also used by tests)
├── test/
│   └── checkout.test.js  # node:test suite with a mocked Stripe client
├── dist/                 # build output (generated; this is what gets deployed)
├── package.json          # scripts + the `stripe` dependency (for the API fn)
├── vercel.json           # Vercel: build command, output dir, function file includes
└── .env.example          # env vars needed for live checkout
```

## Quick start

```bash
cd artist-shop-template
node scripts/build.js        # generate dist/
node scripts/serve.js        # preview at http://localhost:4173
```

Full verification (build + dead-link check + tests):

```bash
npm run verify
```

## Files you edit vs. engine files

**Safe to edit (your content):**
- `data/config.json` — your entire identity: name, bio, tagline, email, Instagram,
  hero text, featured artwork, print sizes and prices
- `data/catalog.json` — your exhibits and artworks (titles, blurbs, image filenames)
- `public/art/` — your artwork JPEGs and `thumbs/` thumbnails
- `src/assets/css/style.css` — colors, fonts, spacing (search for `:root` variables)

**Engine (leave alone unless you know what you're doing):**
- `scripts/build.js`, `scripts/templates.js` — the static site generator (reads your
  config/catalog; already fully brand-neutral — it never hardcodes your name)
- `src/assets/js/shop.js` — cart + checkout client logic
- `api/checkout.js`, `api/_lib.js` — Stripe session creation + server-side price validation
- `test/checkout.test.js`, `scripts/check-links.js` — test suite and link checker

## Setting your artist identity

Open `data/config.json` and replace the sample values:

| Field | What it is |
|---|---|
| `siteName` | Your name or studio name — appears in the header, footer, titles, favicon |
| `artistName` | Your name — appears in the hero eyebrow and about page |
| `tagline` | One line under your name, e.g. "Light, water, and the geometry of cities" |
| `heroTitle` / `heroLede` | The big homepage headline and the paragraph under it |
| `artistBio` | Your story, shown on the About page (plain text, a few sentences) |
| `artistLocation` | City/state — shown in the footer ("made to order in …") |
| `email` | Used by the commissions form |
| `instagram` / `instagramUrl` | Your handle and profile URL |
| `siteUrl` | Your production domain (used for canonical URLs, sitemap, OG images) |
| `featuredArtworkId` | The `id` of the artwork shown big on the homepage (falls back to the first artwork) |

Then rebuild: `node scripts/build.js`.

## Adding exhibits and artworks

Adding a new exhibit is 3 steps — no code changes:

1. **Drop the images** into `public/art/` (full-resolution JPEGs) and matching thumbnails
   into `public/art/thumbs/`. Generate thumbnails with PIL:
   ```bash
   python3 -c "
   from PIL import Image
   im = Image.open('public/art/my-piece.jpg')
   im.thumbnail((900, 900))
   im.save('public/art/thumbs/my-piece.jpg', 'JPEG', quality=82)"
   ```
2. **Add one exhibit object** to `exhibits[]` in `data/catalog.json`:
   `{ "id": "desert", "title": "Desert", "subtitle": "…", "description": "…", "coverImage": "my-piece.jpg" }`.
3. **Add artwork objects** to `artworks[]` with `"exhibitId": "desert"` — each needs
   `id` (unique, URL-safe), `title` (evocative gallery title), `style` (e.g. "Oil on canvas"),
   `image` (filename in `public/art/`), and `blurb` (1–2 sentences).

Then `node scripts/build.js` — the exhibits index, exhibit page, and all artwork pages
(including "more from this exhibit" rails) generate automatically. To remove the sample
art, delete the `sample-*.jpg` files and their catalog entries.

## Setting real prices

**Prices in `data/config.json` are PLACEHOLDERS** (`priceNote` says so explicitly).
Edit `printSizes[].price` (whole dollars) — add, remove, or rename sizes freely; the
storefront, cart subtotals, and server-side checkout all read from this one file, so a
single edit updates everything. Rebuild after changing.

## How cart + checkout work

- **Cart:** `src/assets/js/shop.js` keeps the cart in `localStorage` (`artshop_cart_v1`),
  renders a slide-over drawer on every page, and posts `{ items: [{artworkId, size, qty}] }`
  to `/api/checkout`. The client never sends prices.
- **Checkout:** `api/checkout.js` (Vercel serverless function) validates every item with
  `api/_lib.js` → `buildLineItems()`, which looks up artwork IDs and sizes in
  `data/catalog.json` / `data/config.json` and **recomputes all prices server-side**.
  Unknown artwork IDs, unknown sizes, and bad quantities are rejected with 400.
  It then creates a Stripe Checkout Session with inline `price_data` — **no products need
  to be pre-created in the Stripe dashboard** — collects a shipping address, and returns
  `{ url }` for the browser to redirect to. Success/cancel pages live at
  `/checkout/success/` and `/checkout/cancel/`.
- **Tests:** `test/checkout.test.js` runs 12 tests with a mocked Stripe client covering
  correct pricing, client-price rejection, invalid carts, and error paths.

## Configuring Stripe + deploying on Vercel

1. Create a Stripe account and grab a **secret key** (`sk_live_…`; use `sk_test_…` while testing).
2. In the Vercel project settings → Environment Variables, add:
   - `STRIPE_SECRET_KEY` = your Stripe secret key (Production + Preview as appropriate)
   - `SITE_URL` = `https://your-art-site.com` (your real domain; falls back to the Vercel URL automatically)
3. Deploy: Vercel detects `vercel.json` — build command `node scripts/build.js`, output `dist/`.
   The `stripe` npm package is installed automatically from `package.json` for the API function.
4. Test checkout end-to-end with a test key and Stripe's test card `4242 4242 4242 4242`
   before switching to live keys.
5. Point your domain at the Vercel project and update `siteUrl` in `data/config.json`.

Without `STRIPE_SECRET_KEY`, the "Add to cart" flow still works locally — checkout will
return a clear "not configured" message instead of a Stripe session.

## Design

Warm off-white (`#faf8f3`) gallery walls, ink-black type, Cormorant Garamond display serif
+ Inter body via Google Fonts. Fully responsive (desktop grid → single column on mobile),
keyboard-dismissable cart drawer (Esc), lazy-loaded imagery, semantic HTML. Tune the palette
in the `:root` variables at the top of `src/assets/css/style.css`.
