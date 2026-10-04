/* Template helpers for the artist shop static build. Pure Node, no dependencies. */
'use strict';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function money(config, dollars) {
  return config.currencySymbol + dollars;
}

function shopDataScript(config, catalog) {
  var artworks = {};
  catalog.artworks.forEach(function (a) {
    artworks[a.id] = {
      title: a.title,
      style: a.style,
      image: '/art/' + a.image,
      thumb: '/art/thumbs/' + a.image
    };
  });
  var data = {
    artworks: artworks,
    printSizes: config.printSizes,
    currencySymbol: config.currencySymbol
  };
  return '<script>window.ARTSHOP=' + JSON.stringify(data).replace(/</g, '\\u003c') + ';</script>';
}

function brandHtml(config) {
  var words = String(config.siteName || '').split(' ').filter(Boolean);
  if (words.length > 1) {
    var last = words.pop();
    return esc(words.join(' ')) + ' <em>' + esc(last) + '</em>';
  }
  return esc(config.siteName);
}

function header(config, active) {
  function link(href, label, key) {
    return '<a href="' + href + '"' + (active === key ? ' class="active"' : '') + '>' + label + '</a>';
  }
  return '' +
    '<header class="site-header"><div class="wrap">' +
      '<a class="brand" href="/">' + brandHtml(config) + '</a>' +
      '<button class="menu-toggle" aria-label="Toggle menu">&#9776;</button>' +
      '<nav class="main-nav" aria-label="Main">' +
        link('/exhibits/', 'Exhibits', 'exhibits') +
        link('/about/', 'About', 'about') +
        link('/commissions/', 'Commissions', 'commissions') +
        '<button class="cart-btn" data-open-cart>Cart<span class="cart-count" style="display:none">0</span></button>' +
      '</nav>' +
    '</div></header>';
}

function footer(config) {
  var year = new Date().getFullYear();
  return '' +
    '<footer class="site-footer"><div class="wrap">' +
      '<div class="footer-grid">' +
        '<div><div class="footer-brand">' + brandHtml(config) + '</div>' +
        '<p class="footer-note">' + esc(config.tagline) + '. Archival giclée prints, made to order in ' + esc(config.artistLocation) + '.</p></div>' +
        '<div><h4>Explore</h4>' +
          '<a href="/exhibits/">Exhibits</a>' +
          '<a href="/about/">About the artist</a>' +
          '<a href="/commissions/">Commissions</a></div>' +
        '<div><h4>Connect</h4>' +
          '<a href="' + esc(config.instagramUrl) + '" target="_blank" rel="noopener">Instagram @' + esc(config.instagram) + '</a>' +
          '<a href="mailto:' + esc(config.email) + '">' + esc(config.email) + '</a></div>' +
      '</div>' +
      '<div class="copyright"><span>&copy; ' + year + ' ' + esc(config.siteName) + '. All rights reserved.</span>' +
      '<span>Prints ship worldwide · Secure checkout via Stripe</span></div>' +
    '</div></footer>';
}

function layout(config, catalog, opts) {
  var title = opts.title;
  var desc = opts.description || config.tagline;
  var canonical = (config.siteUrl.replace(/\/$/, '')) + (opts.path || '/');
  var ogImage = opts.ogImage ? config.siteUrl.replace(/\/$/, '') + opts.ogImage : null;
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + esc(title) + ' · ' + esc(config.siteName) + '</title>\n' +
    '<meta name="description" content="' + esc(desc) + '">\n' +
    '<link rel="canonical" href="' + esc(canonical) + '">\n' +
    '<meta property="og:type" content="website">\n' +
    '<meta property="og:title" content="' + esc(title) + ' · ' + esc(config.siteName) + '">\n' +
    '<meta property="og:description" content="' + esc(desc) + '">\n' +
    '<meta property="og:url" content="' + esc(canonical) + '">\n' +
    (ogImage ? '<meta property="og:image" content="' + esc(ogImage) + '">\n' : '') +
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">\n' +
    '<link rel="stylesheet" href="/assets/css/style.css">\n' +
    (opts.extraHead || '') +
    '</head>\n<body>\n' +
    header(config, opts.active) +
    '<main>' + opts.body + '</main>\n' +
    footer(config) +
    shopDataScript(config, catalog) +
    '<script src="/assets/js/shop.js" defer></script>\n' +
    '</body>\n</html>\n';
}

function exhibitCard(config, catalog, exhibit) {
  var works = catalog.artworks.filter(function (a) { return a.exhibitId === exhibit.id; });
  return '' +
    '<a class="exhibit-card" href="/exhibits/' + esc(exhibit.id) + '/">' +
      '<img src="/art/thumbs/' + esc(exhibit.coverImage) + '" alt="' + esc(exhibit.title) + ' exhibit" loading="lazy">' +
      '<div class="exhibit-card-body">' +
        '<h3>' + esc(exhibit.title) + '</h3>' +
        '<p class="sub">' + esc(exhibit.subtitle) + '</p>' +
        '<p>' + works.length + ' works</p>' +
        '<span class="card-link">Enter the exhibit</span>' +
      '</div>' +
    '</a>';
}

function artCard(config, art) {
  var from = Math.min.apply(null, config.printSizes.map(function (s) { return s.price; }));
  return '' +
    '<a class="art-card" href="/works/' + esc(art.id) + '/">' +
      '<div class="frame"><img src="/art/thumbs/' + esc(art.image) + '" alt="' + esc(art.title) + ' — ' + esc(art.style) + '" loading="lazy"></div>' +
      '<h3>' + esc(art.title) + '</h3>' +
      '<p class="style">' + esc(art.style) + '</p>' +
      '<p class="price">from ' + money(config, from) + ' <span>· prints</span></p>' +
    '</a>';
}

module.exports = { esc: esc, money: money, layout: layout, exhibitCard: exhibitCard, artCard: artCard };
