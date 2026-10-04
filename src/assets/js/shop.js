/* Artist shop template — cart drawer + checkout (vanilla JS, no dependencies) */
(function () {
  'use strict';

  var D = window.ARTSHOP || { artworks: {}, printSizes: [], currencySymbol: '$' };
  var KEY = 'artshop_cart_v1';

  function money(cents) {
    return D.currencySymbol + (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      var items = raw ? JSON.parse(raw) : [];
      return Array.isArray(items) ? items : [];
    } catch (e) { return []; }
  }

  function save(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
  }

  function findArt(id) { return D.artworks[id] || null; }
  function findSize(sizeId) {
    for (var i = 0; i < D.printSizes.length; i++) {
      if (D.printSizes[i].id === sizeId) return D.printSizes[i];
    }
    return null;
  }

  function clean(items) {
    return items.filter(function (it) {
      return findArt(it.artworkId) && findSize(it.size) &&
        Number.isInteger(it.qty) && it.qty > 0 && it.qty <= 99;
    });
  }

  function subtotal(items) {
    return clean(items).reduce(function (sum, it) {
      return sum + findSize(it.size).price * 100 * it.qty;
    }, 0);
  }

  function count(items) {
    return clean(items).reduce(function (n, it) { return n + it.qty; }, 0);
  }

  /* ---------- drawer DOM ---------- */
  var drawer, overlay, itemsEl, subEl, countEls, checkoutBtn, errEl, toastEl, toastTimer;

  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function buildDrawer() {
    overlay = el('<div class="cart-overlay" id="cart-overlay" aria-hidden="true"></div>');
    drawer = el(
      '<aside class="cart-drawer" id="cart-drawer" aria-label="Shopping cart" aria-hidden="true">' +
        '<div class="cart-head"><h2>Your Cart</h2>' +
        '<button class="cart-close" id="cart-close" aria-label="Close cart">&times;</button></div>' +
        '<div class="cart-items" id="cart-items"></div>' +
        '<div class="cart-foot" id="cart-foot">' +
          '<div class="subtotal-row"><span>Subtotal</span><span id="cart-subtotal"></span></div>' +
          '<p class="ship-note">Shipping and taxes calculated at checkout.</p>' +
          '<button class="btn btn-primary checkout-btn" id="checkout-btn">Checkout</button>' +
          '<p class="cart-error" id="cart-error"></p>' +
        '</div>' +
      '</aside>'
    );
    toastEl = el('<div class="toast" id="toast" role="status"></div>');
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    document.body.appendChild(toastEl);
    itemsEl = document.getElementById('cart-items');
    subEl = document.getElementById('cart-subtotal');
    checkoutBtn = document.getElementById('checkout-btn');
    errEl = document.getElementById('cart-error');
    countEls = Array.prototype.slice.call(document.querySelectorAll('.cart-count'));

    document.getElementById('cart-close').addEventListener('click', close);
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    checkoutBtn.addEventListener('click', checkout);
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  function open() {
    render();
    drawer.classList.add('open');
    overlay.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function render() {
    var items = clean(load());
    save(items);
    var n = count(items);
    countEls.forEach(function (c) {
      c.textContent = n;
      c.style.display = n ? '' : 'none';
    });

    if (!items.length) {
      itemsEl.innerHTML =
        '<div class="cart-empty"><p>Your cart is empty.</p>' +
        '<a class="btn btn-ghost" href="/exhibits/">Browse the exhibits</a></div>';
      document.getElementById('cart-foot').style.display = 'none';
      return;
    }
    document.getElementById('cart-foot').style.display = '';

    itemsEl.innerHTML = '';
    items.forEach(function (it, idx) {
      var art = findArt(it.artworkId);
      var size = findSize(it.size);
      var node = el(
        '<div class="cart-item">' +
          '<img src="' + esc(art.thumb) + '" alt="' + esc(art.title) + '">' +
          '<div><h4>' + esc(art.title) + '</h4>' +
          '<p class="meta">' + esc(size.label) + ' print</p>' +
          '<div class="row">' +
            '<span class="mini-stepper">' +
              '<button data-act="dec" data-idx="' + idx + '" aria-label="Decrease quantity">−</button>' +
              '<span>' + it.qty + '</span>' +
              '<button data-act="inc" data-idx="' + idx + '" aria-label="Increase quantity">+</button>' +
            '</span>' +
            '<button class="cart-remove" data-act="rm" data-idx="' + idx + '">Remove</button>' +
          '</div></div>' +
          '<div class="line-total">' + money(size.price * 100 * it.qty) + '</div>' +
        '</div>'
      );
      itemsEl.appendChild(node);
    });

    itemsEl.querySelectorAll('button[data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var items2 = clean(load());
        var it = items2[+b.dataset.idx];
        if (!it) return;
        if (b.dataset.act === 'inc') it.qty = Math.min(99, it.qty + 1);
        if (b.dataset.act === 'dec') it.qty = Math.max(1, it.qty - 1);
        if (b.dataset.act === 'rm') items2.splice(+b.dataset.idx, 1);
        save(items2);
        render();
      });
    });

    subEl.textContent = money(subtotal(items));
    errEl.style.display = 'none';
  }

  function addToCart(artworkId, size, qty) {
    var art = findArt(artworkId), sz = findSize(size);
    if (!art || !sz) return false;
    qty = Math.max(1, Math.min(99, qty | 0 || 1));
    var items = clean(load());
    var found = null;
    items.forEach(function (it) {
      if (it.artworkId === artworkId && it.size === size) found = it;
    });
    if (found) found.qty = Math.min(99, found.qty + qty);
    else items.push({ artworkId: artworkId, size: size, qty: qty });
    save(items);
    render();
    return true;
  }

  function checkout() {
    var items = clean(load());
    if (!items.length) return;
    errEl.style.display = 'none';
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = 'Redirecting…';
    fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (res.ok && res.body && res.body.url) {
          window.location.href = res.body.url;
        } else {
          throw new Error((res.body && res.body.error) || 'Checkout failed. Please try again.');
        }
      })
      .catch(function (e) {
        errEl.textContent = e.message;
        errEl.style.display = 'block';
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = 'Checkout';
      });
  }

  /* ---------- page bindings ---------- */
  function bindPage() {
    document.querySelectorAll('[data-open-cart]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); open(); });
    });
    var toggle = document.querySelector('.menu-toggle');
    var nav = document.querySelector('.main-nav');
    if (toggle && nav) {
      toggle.addEventListener('click', function () { nav.classList.toggle('open'); });
    }

    // Artwork page buy box
    var buyBox = document.querySelector('[data-buy-box]');
    if (buyBox) {
      var artworkId = buyBox.dataset.artworkId;
      var selectedSize = null;
      var qty = 1;
      var pills = Array.prototype.slice.call(buyBox.querySelectorAll('.size-pill'));
      var qtyVal = buyBox.querySelector('.qty-val');

      function select(pill) {
        pills.forEach(function (p) { p.classList.remove('selected'); });
        pill.classList.add('selected');
        selectedSize = pill.dataset.size;
      }
      pills.forEach(function (p) {
        p.addEventListener('click', function () { select(p); });
      });
      if (pills.length) select(pills[0]);

      buyBox.querySelectorAll('[data-qty]').forEach(function (b) {
        b.addEventListener('click', function () {
          qty = b.dataset.qty === 'inc' ? Math.min(99, qty + 1) : Math.max(1, qty - 1);
          qtyVal.textContent = qty;
        });
      });

      buyBox.querySelector('[data-add]').addEventListener('click', function () {
        if (addToCart(artworkId, selectedSize, qty)) {
          var art = findArt(artworkId);
          toast('Added “' + art.title + '” to your cart');
          open();
        }
      });
    }

    // Commission form -> mailto
    var cform = document.getElementById('commission-form');
    if (cform) {
      cform.addEventListener('submit', function (e) {
        e.preventDefault();
        var to = cform.dataset.email;
        var name = cform.name.value.trim();
        var email = cform.email.value.trim();
        var budget = cform.budget.value;
        var idea = cform.idea.value.trim();
        var subject = 'Commission inquiry from ' + name;
        var body = 'Name: ' + name + '\nEmail: ' + email + '\nBudget: ' + budget + '\n\nThe idea:\n' + idea;
        window.location.href = 'mailto:' + to +
          '?subject=' + encodeURIComponent(subject) +
          '&body=' + encodeURIComponent(body);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    buildDrawer();
    render();
    bindPage();
  });

  window.ArtShopCart = { open: open, close: close, addToCart: addToCart, count: function () { return count(load()); } };
})();
