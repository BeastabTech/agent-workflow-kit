const test = require('node:test');
const assert = require('node:assert');
const { createCart, addItem, subtotal, total } = require('../lib/cart');

test('adds items and merges the same sku', () => {
  const c = createCart();
  addItem(c, 'a', 500, 2);
  addItem(c, 'a', 500);
  assert.equal(c.items[0].qty, 3);
  assert.equal(subtotal(c), 1500);
  assert.equal(total(c), 1500);
});
