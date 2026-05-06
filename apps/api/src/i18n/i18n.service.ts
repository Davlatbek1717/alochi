import { Injectable } from '@nestjs/common';
import { translateError, ErrorKey } from './errors';

/**
 * Singleton i18n helper. Returns Uzbek error strings — single-locale
 * platform, no Accept-Language handling.
 */
@Injectable()
export class I18nService {
  /** Translate an error key to Uzbek. Returns the key when unknown. */
  t(key: ErrorKey): string {
    return translateError(key);
  }
}
