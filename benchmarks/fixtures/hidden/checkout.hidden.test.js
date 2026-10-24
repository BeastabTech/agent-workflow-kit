const test = require('node:test');
const assert = require('node:assert');
const { createCart, addItem, quote } = require('../lib/cart');

const now = new Date('2026-06-01T00:00:00Z');
const mk = (...lines) => lines.reduce((c, [sku, p, q]) => addItem(c, sku, p, q), createCart());

test('empty cart: everything is zero, no shipping, no tax', () => {
  assert.deepEqual(quote(createCart(), { taxRate: 8, now }), { subtotal: 0, discount: 0, shipping: 0, tax: 0, total: 0 });
});
test('plain cart: flat 500 shipping under the threshold, tax on the subtotal only', () => {
  const q = quote(mk(['a', 1000, 2]), { taxRate: 10, now }); // 2000, +500 shipping, tax 200
  assert.deepEqual(q, { subtotal: 2000, discount: 0, shipping: 500, tax: 200, total: 2700 });
});
test('free shipping when the amount after discount is 5000 or more', () => {
  assert.equal(quote(mk(['a', 5000, 1]), { taxRate: 0, now }).shipping, 0);
  assert.equal(quote(mk(['a', 4999, 1]), { taxRate: 0, now }).shipping, 500);
});
test('the threshold uses the amount AFTER the discount', () => {
  const q = quote(mk(['a', 5200, 1]), { taxRate: 0, now, coupon: { code: 'F', type: 'fixed', value: 300 } }); // 4900 after
  assert.equal(q.shipping, 500);
  assert.equal(q.total, 4900 + 500);
});
test('percent coupon rounds half up; tax is on the discounted amount, not on shipping', () => {
  const q = quote(mk(['a', 1999, 1]), { taxRate: 7, now, coupon: { code: 'P', type: 'percent', value: 10 } });
  // discount 199.9 -> 200; after 1799; tax 125.93 -> 126; shipping 500
  assert.deepEqual(q, { subtotal: 1999, discount: 200, shipping: 500, tax: 126, total: 1799 + 500 + 126 });
});
test('tax rounds half up', () => {
  assert.equal(quote(mk(['a', 1050, 1]), { taxRate: 5, now }).tax, 53); // 52.5 -> 53
});
test('a coupon never takes more than the subtotal, and a free cart pays no tax', () => {
  const q = quote(mk(['a', 300, 1]), { taxRate: 20, now, coupon: { code: 'F', type: 'fixed', value: 9999 } });
  assert.equal(q.discount, 300);
  assert.equal(q.tax, 0);
  assert.equal(q.total, 500); // only shipping is left
});
test('expired and invalid coupons are rejected', () => {
  const c = mk(['a', 1000, 1]);
  assert.throws(() => quote(c, { now, coupon: { code: 'E', type: 'percent', value: 10, expires: '2026-05-31T00:00:00Z' } }));
  assert.throws(() => quote(c, { now, coupon: { code: 'X', type: 'percent', value: 101 } }));
  assert.throws(() => quote(c, { now, coupon: { code: 'X', type: 'fixed', value: -1 } }));
  assert.throws(() => quote(c, { now, coupon: { code: 'X', type: 'bogo', value: 1 } }));
});
test('invalid tax rate is rejected (negative, over 100, not a number)', () => {
  const c = mk(['a', 1000, 1]);
  for (const r of [-1, 101, 'ten', NaN]) assert.throws(() => quote(c, { taxRate: r, now }), undefined, String(r));
});
test('quote does not change the cart', () => {
  const c = mk(['a', 1000, 2]);
  const before = JSON.stringify(c);
  quote(c, { taxRate: 8, now, coupon: { code: 'P', type: 'percent', value: 10 } });
  assert.equal(JSON.stringify(c), before);
});
test('all amounts are integers and total adds up', () => {
  const q = quote(mk(['a', 333, 3], ['b', 17, 7]), { taxRate: 8.25, now, coupon: { code: 'P', type: 'percent', value: 15 } });
  for (const v of Object.values(q)) assert.ok(Number.isInteger(v), JSON.stringify(q));
  assert.equal(q.total, q.subtotal - q.discount + q.shipping + q.tax);
});
test('taxRate defaults to 0 and a coupon is optional', () => {
  assert.deepEqual(quote(mk(['a', 6000, 1]), { now }), { subtotal: 6000, discount: 0, shipping: 0, tax: 0, total: 6000 });
});
