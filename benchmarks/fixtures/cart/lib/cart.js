'use strict';
// Prices are integer cents. A cart is { items: [{ sku, price, qty }] }.
function createCart() {
  return { items: [] };
}

function addItem(cart, sku, price, qty = 1) {
  if (!Number.isInteger(price) || price < 0) throw new Error('price must be integer cents');
  if (!Number.isInteger(qty) || qty < 1) throw new Error('qty must be a positive integer');
  const found = cart.items.find((i) => i.sku === sku);
  if (found) found.qty += qty;
  else cart.items.push({ sku, price, qty });
  return cart;
}

function subtotal(cart) {
  return cart.items.reduce((n, i) => n + i.price * i.qty, 0);
}

function total(cart) {
  return subtotal(cart);
}

module.exports = { createCart, addItem, subtotal, total };
