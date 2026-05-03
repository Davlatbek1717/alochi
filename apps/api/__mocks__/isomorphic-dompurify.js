// Jest stub for isomorphic-dompurify.
// The real package pulls in jsdom → html-encoding-sniffer → @exodus/bytes
// which is ESM-only and cannot be transformed by ts-jest.
// We implement a lightweight sanitizer here that strips all HTML tags and
// event-handler attributes, which is sufficient for the chat-xss unit tests.
// The production service still uses the real isomorphic-dompurify at runtime.

function sanitize(input) {
  if (typeof input !== 'string') return '';
  // Remove script tag contents first (including the tag)
  let out = input.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  // Remove all remaining tags (self-closing or not)
  out = out.replace(/<[^>]+>/g, '');
  return out;
}

const DOMPurify = {
  sanitize,
  addHook: () => {},
  removeHook: () => {},
  removeHooks: () => {},
  removeAllHooks: () => {},
  isSupported: true,
  setConfig: () => {},
  clearConfig: () => {},
  isValidAttribute: () => true,
  version: '3.x-mock',
};

// Allow calling DOMPurify directly as a function (isomorphic-dompurify can be
// used as DOMPurify(input) or DOMPurify.sanitize(input)).
const proxy = new Proxy(DOMPurify, {
  apply(_target, _thisArg, args) {
    return sanitize(args[0]);
  },
});

module.exports = proxy;
module.exports.default = proxy;
module.exports.sanitize = sanitize;
