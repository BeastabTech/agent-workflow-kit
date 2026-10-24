const test = require('node:test');
const assert = require('node:assert');
const { createCart, addItem, subtotal, removeItem } = require('../lib/cart');

const cart = () => addItem(addItem(createCart(), 'a', 100, 3), 'b', 250, 1);

test('removeItem with no qty removes the whole line', () => {
  const c = cart();
  removeItem(c, 'a');
  assert.deepEqual(c.items.map((i) => i.sku), ['b']);
  assert.equal(subtotal(c), 250);
});
test('removeItem with a qty reduces the line', () => {
  const c = cart();
  removeItem(c, 'a', 2);
  assert.equal(c.items.find((i) => i.sku === 'a').qty, 1);
});
test('removing as many as there are, or more, removes the line', () => {
  const c = cart();
  removeItem(c, 'a', 3);
  assert.equal(c.items.some((i) => i.sku === 'a'), false);
  removeItem(c, 'b', 99);
  assert.equal(c.items.length, 0);
});
test('unknown sku throws and leaves the cart unchanged', () => {
  const c = cart();
  assert.throws(() => removeItem(c, 'zzz'));
  assert.equal(subtotal(c), 550);
});
test('invalid qty throws (zero, negative, fraction) and leaves the cart unchanged', () => {
  for (const q of [0, -1, 1.5]) {
    const c = cart();
    assert.throws(() => removeItem(c, 'a', q), undefined, String(q));
    assert.equal(subtotal(c), 550);
  }
});
