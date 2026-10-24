// Hidden acceptance tests for the coupon task. The agent never sees this file.
const test = require('node:test');
const assert = require('node:assert');
const { createCart, addItem, total, applyCoupon } = require('./cart/lib/cart');

const cart = () => addItem(addItem(createCart(), 'a', 1000, 2), 'b', 333, 1); // subtotal 2333
const now = new Date('2026-06-01T00:00:00Z');
const pct = (p, extra = {}) => ({ code: 'P' + p, type: 'percent', value: p, ...extra });
const fix = (v, extra = {}) => ({ code: 'F' + v, type: 'fixed', value: v, ...extra });

test('percent coupon, rounded to whole cents (round half up)', () => { // 2333 * 10% = 233.3
  const c = cart();
  applyCoupon(c, pct(10), now);
  assert.equal(total(c), 2333 - 233);
});
test('fixed coupon in cents', () => {
  const c = cart();
  applyCoupon(c, fix(500), now);
  assert.equal(total(c), 1833);
});
test('total never goes below zero', () => {
  const c = cart();
  applyCoupon(c, fix(99999), now);
  assert.equal(total(c), 0);
});
test('expired coupon is rejected and the cart is unchanged', () => {
  const c = cart();
  assert.throws(() => applyCoupon(c, pct(10, { expires: '2026-05-31T23:59:59Z' }), now));
  assert.equal(total(c), 2333);
});
test('coupon that expires later is accepted', () => {
  const c = cart();
  applyCoupon(c, pct(10, { expires: '2026-06-02T00:00:00Z' }), now);
  assert.equal(total(c), 2100);
});
test('only one coupon per cart; the first stays', () => {
  const c = cart();
  applyCoupon(c, fix(500), now);
  assert.throws(() => applyCoupon(c, pct(10), now));
  assert.equal(total(c), 1833);
});
test('invalid coupons are rejected: percent over 100 or below 1, negative or non-integer fixed, unknown type', () => {
  for (const bad of [pct(101), pct(0), fix(-5), fix(2.5), { code: 'X', type: 'bogo', value: 1 }]) {
    assert.throws(() => applyCoupon(cart(), bad, now), undefined, JSON.stringify(bad));
  }
});
test('coupon applies to later changes of the cart (items added after applying)', () => {
  const c = cart();
  applyCoupon(c, pct(50), now);
  addItem(c, 'c', 1000, 1); // subtotal 3333 -> 50% = 1666.5 -> round half up 1667 off
  assert.equal(total(c), 3333 - 1667);
});
