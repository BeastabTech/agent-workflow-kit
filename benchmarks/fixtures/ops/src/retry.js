'use strict';
function retry(fn, times = 3) {
  let last;
  for (let i = 0; i < times; i++) {
    try { return fn(); } catch (e) { last = e; }
  }
  throw last;
}
module.exports = { retry };
