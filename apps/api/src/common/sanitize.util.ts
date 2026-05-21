// eslint-disable-next-line @typescript-eslint/no-require-imports
const sanitizeHtml = require('sanitize-html') as typeof import('sanitize-html');

const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'a', 'br', 'p', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 's'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
  },
  allowedSchemes: ['https', 'mailto', 'tg'],
  allowedSchemesByTag: {
    a: ['https', 'mailto', 'tg'],
  },
  // Force rel="noopener noreferrer" on all links to prevent tab-napping
  transformTags: {
    a: (_tagName, attribs) => ({
      tagName: 'a',
      attribs: { ...attribs, rel: 'noopener noreferrer', target: '_blank' },
    }),
  },
};

/** Sanitize rich-text content (allows safe HTML formatting tags). */
export function sanitizeRichText(input: string | null | undefined): string {
  if (!input) return '';
  return sanitizeHtml(input, RICH_TEXT_OPTIONS);
}

/** Strip ALL HTML — use for plain-text fields where no markup is expected. */
export function sanitizePlainText(input: string | null | undefined): string {
  if (!input) return '';
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} });
}
