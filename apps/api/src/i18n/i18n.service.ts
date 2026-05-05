import { Injectable } from '@nestjs/common';
import { translateError, localeFromHeader, ErrorKey } from './errors';

/**
 * Singleton i18n helper.  Services inject this and call t(key, locale)
 * where `locale` comes from the controller via req.headers['accept-language'].
 *
 * This is intentionally NOT request-scoped — a REQUEST-scoped service
 * cannot be injected into singleton services without cascading their
 * scope, which degrades performance on every request.  Instead, the
 * locale is passed explicitly so the call site controls it.
 */
@Injectable()
export class I18nService {
  /** Translate an error key to the requested locale (falls back to uz). */
  t(key: ErrorKey, locale = 'uz'): string {
    return translateError(key, locale);
  }

  /** Parse Accept-Language header → 2-char locale code. */
  locale(acceptLanguage: string | undefined): string {
    return localeFromHeader(acceptLanguage);
  }
}
