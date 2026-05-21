import sanitizeHtml from 'sanitize-html';

/**
 * Allowed HTML for rich-text fields authored by staff (lesson hints,
 * AI tutor context, warning notes, visit notes).
 * Stricter than the editor allows — attacker-uploaded content always
 * passes through this before being stored or returned to clients.
 */
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
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
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
