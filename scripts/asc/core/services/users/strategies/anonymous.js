// ASC Core — do not edit. Customize via scripts/asc/configurations.js

import AuthStrategy from './strategy.js';

/**
 * Anonymous — the default. No identity, no credentials attached, media URLs
 * untouched. Suitable for a fully public DAM. Everything is inherited from the
 * base AuthStrategy defaults; this subclass exists only to give the default a
 * real, named entry in the strategy registry (so no code path is special-cased).
 */
export default class AnonymousStrategy extends AuthStrategy {
  static id = 'anonymous';
}
