/**
 * All translation keys used by the app.
 *
 * Dot-namespaced by UI area. Adding a key here forces both dictionaries
 * (`en.ts` and `pt.ts`) to provide a value, since both are typed as
 * `Record<TranslationKey, string>`.
 */
export type TranslationKey =
  | 'nav.home'
  | 'nav.tuner'
  | 'nav.practice.score'
  | 'nav.practice.trumpet'
  | 'section.ear_training'
  | 'section.practice'
  | 'section.drills'
  | 'brand.tagline'
  | 'card.mic.title'
  | 'card.mic.body'
  | 'lang.toggle_label';
