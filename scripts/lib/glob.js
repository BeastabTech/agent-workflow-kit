'use strict';
/** Minimal glob to RegExp: supports **, *, ? and {a,b}. Paths use forward slashes. */
function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        const slash = glob[i + 2] === '/';
        re += slash ? '(?:.*/)?' : '.*';
        i += slash ? 2 : 1;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if (c === '{') {
      const end = glob.indexOf('}', i);
      if (end === -1) {
        re += '\\{';
      } else {
        re += '(?:' + glob.slice(i + 1, end).split(',').map(escape).join('|') + ')';
        i = end;
      }
    } else {
      re += escape(c);
    }
  }
  return new RegExp('^' + re + '$');
}

function escape(s) {
  return s.replace(/[.+^$()|[\]\\]/g, '\\$&');
}

function matchesAny(relPath, globs) {
  const p = relPath.split('\\').join('/');
  return (globs || []).some((g) => globToRegExp(g).test(p));
}

module.exports = { globToRegExp, matchesAny };
