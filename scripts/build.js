/* Artist shop static site builder. Pure Node.js, zero dependencies.
 * Usage: node scripts/build.js
 * Reads data/catalog.json + data/config.json, emits static HTML into dist/.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const T = require('./templates');

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/config.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog.json'), 'utf8'));

function worksOf(exhibitId) {
  return catalog.artworks.filter(function (a) { return a.exhibitId === exhibitId; });
}

function write(relPath, html) {
  const full = path.join(DIST, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, html, 'utf8');
  return relPath;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    const s = path.join(src, f), d = path.join(dest, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/* ---------------- page bodies ---------------- */

function homePage() {
  const featured = catalog.artworks.find(function (a) { return a.id === config.featuredArtworkId; }) || catalog.artworks[0];
  const exhibitCards = catalog.exhibits.map(function (e) { return T.exhibitCard(config, catalog, e); }).join('\n');
  const body =
    '<section class="hero"><div class="wrap"><div class="hero-grid">' +
      '<div><p class="eyebrow">The gallery of ' + T.esc(config.artistName) + '</p>' +
      '<h1>' + T.esc(config.heroTitle) + '</h1>' +
      '<p class="lede">' + T.esc(config.heroLede) + '</p>' +
      '<div class="btn-row">' +
        '<a class="btn btn-primary" href="/exhibits/">Explore the exhibits</a>' +
        '<a class="btn btn-ghost" href="/about/">About the artist</a>' +
      '</div></div>' +
      '<figure class="hero-figure">' +
        '<img src="/art/' + T.esc(featured.image) + '" alt="' + T.esc(featured.title) + ' — ' + T.esc(featured.style) + '" fetchpriority="high">' +
        '<figcaption>' + T.esc(featured.title) + ' · ' + T.esc(featured.style) + '</figcaption>' +
      '</figure>' +
    '</div></div></section>' +
    '<section class="section"><div class="wrap">' +
      '<div class="section-head"><p class="eyebrow">Exhibits</p>' +
      '<h2>Step inside the gallery</h2>' +
      '<p>Each exhibit is a world of its own. New exhibits open as new bodies of work are completed.</p></div>' +
      '<div class="exhibit-grid">' + exhibitCards + '</div>' +
    '</div></section>' +
    '<section class="section" style="background:var(--bg-soft)"><div class="wrap">' +
      '<div class="section-head"><p class="eyebrow">Prints</p>' +
      '<h2>Museum quality, made to order</h2></div>' +
      '<div class="steps">' +
        '<div class="step"><div class="num">I.</div><h3>Archival giclée</h3><p>Printed with pigment inks on enhanced matte fine-art paper — rated to hold its color for a century.</p></div>' +
        '<div class="step"><div class="num">II.</div><h3>Four sizes</h3><p>From an intimate 8 × 10 to a statement 24 × 36. Every piece is printed to order, never warehoused.</p></div>' +
        '<div class="step"><div class="num">III.</div><h3>Ships worldwide</h3><p>Prints ship unframed in protective flat packaging, with tracking from door to door.</p></div>' +
      '</div>' +
    '</div></section>';
  return T.layout(config, catalog, {
    title: 'Original shoreline art & fine-art prints',
    description: config.tagline + '. Original works and archival giclée prints by ' + config.artistName + '.',
    path: '/',
    active: null,
    ogImage: '/art/' + featured.image,
    body: body
  });
}

function exhibitsIndexPage() {
  const cards = catalog.exhibits.map(function (e) { return T.exhibitCard(config, catalog, e); }).join('\n');
  const body =
    '<section class="section"><div class="wrap">' +
      '<p class="crumb"><a href="/">Home</a> · Exhibits</p>' +
      '<div class="section-head"><p class="eyebrow">The collection</p>' +
      '<h2>Exhibits</h2>' +
      '<p>Curated bodies of work, each with its own room in the gallery.</p></div>' +
      '<div class="exhibit-grid">' + cards + '</div>' +
    '</div></section>';
  return T.layout(config, catalog, {
    title: 'Exhibits', description: 'Browse the exhibits of ' + config.siteName + ' — curated bodies of work.',
    path: '/exhibits/', active: 'exhibits', body: body
  });
}

function exhibitPage(exhibit) {
  const works = worksOf(exhibit.id);
  const cards = works.map(function (a) { return T.artCard(config, a); }).join('\n');
  const body =
    '<section class="section"><div class="wrap">' +
      '<p class="crumb"><a href="/">Home</a> · <a href="/exhibits/">Exhibits</a> · ' + T.esc(exhibit.title) + '</p>' +
      '<div class="section-head"><p class="eyebrow">Exhibit</p>' +
      '<h2>' + T.esc(exhibit.title) + '</h2>' +
      '<p class="lede" style="font-family:var(--serif);font-style:italic;font-size:20px;color:var(--ink)">' + T.esc(exhibit.subtitle) + '</p>' +
      '<p>' + T.esc(exhibit.description) + '</p></div>' +
      '<div class="art-grid">' + cards + '</div>' +
    '</div></section>';
  return T.layout(config, catalog, {
    title: exhibit.title + ' — exhibit',
    description: exhibit.subtitle,
    path: '/exhibits/' + exhibit.id + '/',
    active: 'exhibits',
    ogImage: '/art/thumbs/' + exhibit.coverImage,
    body: body
  });
}

function artworkPage(art) {
  const exhibit = catalog.exhibits.find(function (e) { return e.id === art.exhibitId; });
  const others = worksOf(art.exhibitId).filter(function (a) { return a.id !== art.id; }).slice(0, 4);
  const related = others.map(function (a) { return T.artCard(config, a); }).join('\n');
  const pills = config.printSizes.map(function (s) {
    return '<button type="button" class="size-pill" data-size="' + T.esc(s.id) + '">' +
      '<span class="dim">' + T.esc(s.label) + '</span>' +
      '<span class="pr">' + T.money(config, s.price) + '</span></button>';
  }).join('\n');
  const body =
    '<section><div class="wrap">' +
      '<div class="artwork-layout">' +
        '<div class="artwork-image"><p class="crumb"><a href="/">Home</a> · <a href="/exhibits/">Exhibits</a> · <a href="/exhibits/' + T.esc(exhibit.id) + '/">' + T.esc(exhibit.title) + '</a></p>' +
        '<img src="/art/' + T.esc(art.image) + '" alt="' + T.esc(art.title) + ' — ' + T.esc(art.style) + '"></div>' +
        '<div class="artwork-info">' +
          '<h1>' + T.esc(art.title) + '</h1>' +
          '<p class="style">' + T.esc(art.style) + '</p>' +
          '<p class="blurb">' + T.esc(art.blurb) + '</p>' +
          '<div class="edition"><strong>Edition</strong>' + T.esc(config.editionInfo) + '</div>' +
          '<div class="buy-box" data-buy-box data-artwork-id="' + T.esc(art.id) + '">' +
            '<h3>Choose a print size</h3>' +
            '<div class="size-pills">' + pills + '</div>' +
            '<div class="qty-row"><h3 style="margin:0">Quantity</h3>' +
              '<span class="qty-stepper">' +
                '<button type="button" data-qty="dec" aria-label="Decrease quantity">−</button>' +
                '<span class="qty-val">1</span>' +
                '<button type="button" data-qty="inc" aria-label="Increase quantity">+</button>' +
              '</span></div>' +
            '<button type="button" class="btn btn-primary add-btn" data-add>Add to cart</button>' +
            '<p class="buy-note">Secure checkout via Stripe. Shipping and taxes calculated at checkout.</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div></section>' +
    (related ?
      '<section class="section" style="padding-top:0"><div class="wrap">' +
        '<div class="section-head"><h2>More from ' + T.esc(exhibit.title) + '</h2></div>' +
        '<div class="art-grid">' + related + '</div>' +
      '</div></section>' : '');
  return T.layout(config, catalog, {
    title: art.title,
    description: art.title + ' — ' + art.style + '. ' + art.blurb,
    path: '/works/' + art.id + '/',
    active: 'exhibits',
    ogImage: '/art/' + art.image,
    body: body
  });
}

function aboutPage() {
  const cover = catalog.exhibits[0] ? catalog.exhibits[0].coverImage : catalog.artworks[0].image;
  const body =
    '<section><div class="wrap"><div class="about-grid">' +
      '<div><img src="/art/' + T.esc(cover) + '" alt="Artwork by ' + T.esc(config.artistName) + '"></div>' +
      '<div class="prose"><p class="eyebrow">About</p>' +
      '<h1>The artist</h1>' +
      '<p class="lede">' + T.esc(config.tagline) + '.</p>' +
      '<p>' + T.esc(config.artistBio) + '</p>' +
      '<p>Every print is produced as an archival giclée on enhanced matte fine-art paper, printed to order and inspected by hand before it ships.</p>' +
      '<div class="btn-row" style="margin-top:28px">' +
        '<a class="btn btn-primary" href="/exhibits/">View the exhibits</a>' +
        '<a class="btn btn-ghost" href="' + T.esc(config.instagramUrl) + '" target="_blank" rel="noopener">Instagram</a>' +
      '</div></div>' +
    '</div></div></section>';
  return T.layout(config, catalog, {
    title: 'About the artist',
    description: 'About ' + config.artistName + ' — ' + config.tagline + '.',
    path: '/about/', active: 'about', body: body
  });
}

function commissionsPage() {
  const body =
    '<section class="section"><div class="wrap">' +
      '<div class="prose"><p class="eyebrow">Commissions</p>' +
      '<h1>Let\u2019s make something together</h1>' +
      '<p class="lede">Custom pieces, alternate sizes, framing, and private commissions.</p>' +
      '<p>Have a piece in mind? Want an existing work in a grander size, or framed and ready to hang? Send the details below — every inquiry gets a personal reply.</p></div>' +
      '<form class="form" id="commission-form" data-email="' + T.esc(config.email) + '" style="margin-top:32px">' +
        '<div class="field"><label for="cf-name">Your name</label><input id="cf-name" name="name" required autocomplete="name"></div>' +
        '<div class="field"><label for="cf-email">Email</label><input id="cf-email" name="email" type="email" required autocomplete="email"></div>' +
        '<div class="field"><label for="cf-budget">Budget range</label><select id="cf-budget" name="budget">' +
          '<option>Under $200</option><option>$200 – $500</option><option>$500 – $1,500</option><option>$1,500+</option><option>Not sure yet</option>' +
        '</select></div>' +
        '<div class="field"><label for="cf-idea">Tell me about the piece</label><textarea id="cf-idea" name="idea" required placeholder="Which piece caught your eye? What size, what room, what feeling?"></textarea></div>' +
        '<button type="submit" class="btn btn-primary">Send inquiry</button>' +
        '<p class="buy-note">This opens your email app addressed to ' + T.esc(config.email) + '. Prefer DMs? Find me at <a href="' + T.esc(config.instagramUrl) + '" target="_blank" rel="noopener" style="text-decoration:underline">@' + T.esc(config.instagram) + '</a>.</p>' +
      '</form>' +
    '</div></section>';
  return T.layout(config, catalog, {
    title: 'Commissions',
    description: 'Commission a custom piece from ' + config.artistName + ' — alternate sizes, framing, and private works.',
    path: '/commissions/', active: 'commissions', body: body
  });
}

function successPage() {
  const body =
    '<section><div class="wrap"><div class="result">' +
      '<div class="mark ok">✓</div>' +
      '<h1>Thank you.</h1>' +
      '<p>Your order is confirmed. A receipt is on its way to your inbox, and your prints will be made to order and shipped with tracking. Welcome to the collection.</p>' +
      '<div class="btn-row" style="justify-content:center">' +
        '<a class="btn btn-primary" href="/exhibits/">Keep exploring</a>' +
      '</div>' +
    '</div></div></section>';
  return T.layout(config, catalog, {
    title: 'Order confirmed', description: 'Your ' + config.siteName + ' order is confirmed.',
    path: '/checkout/success/', active: null, body: body
  });
}

function cancelPage() {
  const body =
    '<section><div class="wrap"><div class="result">' +
      '<div class="mark no">×</div>' +
      '<h1>Checkout canceled.</h1>' +
      '<p>No charge was made — your cart is saved, and your prints will be here whenever you\u2019re ready.</p>' +
      '<div class="btn-row" style="justify-content:center">' +
        '<a class="btn btn-primary" href="/exhibits/">Back to the gallery</a>' +
      '</div>' +
    '</div></div></section>';
  return T.layout(config, catalog, {
    title: 'Checkout canceled', description: 'Your checkout was canceled. Your cart is saved.',
    path: '/checkout/cancel/', active: null, body: body
  });
}

function faviconSvg() {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<rect width="64" height="64" rx="8" fill="#faf8f3"/>' +
    '<text x="32" y="44" font-family="Georgia, serif" font-size="38" font-style="italic" text-anchor="middle" fill="#1a1815">' + T.esc(config.siteName.charAt(0)) + '</text>' +
    '</svg>\n';
}

/* ---------------- build ---------------- */

function main() {
  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const pages = [];
  pages.push(write('index.html', homePage()));
  pages.push(write('exhibits/index.html', exhibitsIndexPage()));
  for (const e of catalog.exhibits) pages.push(write('exhibits/' + e.id + '/index.html', exhibitPage(e)));
  for (const a of catalog.artworks) pages.push(write('works/' + a.id + '/index.html', artworkPage(a)));
  pages.push(write('about/index.html', aboutPage()));
  pages.push(write('commissions/index.html', commissionsPage()));
  pages.push(write('checkout/success/index.html', successPage()));
  pages.push(write('checkout/cancel/index.html', cancelPage()));

  // static assets + art
  copyDir(path.join(ROOT, 'src/assets'), path.join(DIST, 'assets'));
  copyDir(path.join(ROOT, 'public/art'), path.join(DIST, 'art'));
  fs.writeFileSync(path.join(DIST, 'favicon.svg'), faviconSvg());
  fs.writeFileSync(path.join(DIST, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: ' + config.siteUrl.replace(/\/$/, '') + '/sitemap.xml\n');

  // sitemap
  const urls = ['/', '/exhibits/', '/about/', '/commissions/']
    .concat(catalog.exhibits.map(function (e) { return '/exhibits/' + e.id + '/'; }))
    .concat(catalog.artworks.map(function (a) { return '/works/' + a.id + '/'; }));
  const base = config.siteUrl.replace(/\/$/, '');
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(function (u) { return '  <url><loc>' + base + u + '</loc></url>'; }).join('\n') +
    '\n</urlset>\n');

  console.log('Built ' + pages.length + ' pages into dist/');
}

main();
