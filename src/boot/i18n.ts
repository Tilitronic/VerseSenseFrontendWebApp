import { defineBoot } from '#q-app/wrappers';
import { createI18n } from 'vue-i18n';

import messages from 'src/i18n';

export type MessageLanguages = keyof typeof messages;
// Type-define 'en-US' as the master schema for the resource
export type MessageSchema = (typeof messages)['en-US'];

// See https://vue-i18n.intlify.dev/guide/advanced/typescript.html#global-resource-schema-type-definition
/* eslint-disable @typescript-eslint/no-empty-object-type */
declare module 'vue-i18n' {
  // define the locale messages schema
  export interface DefineLocaleMessage extends MessageSchema {}

  // define the datetime format schema
  export interface DefineDateTimeFormat {}

  // define the number format schema
  export interface DefineNumberFormat {}
}
/* eslint-enable @typescript-eslint/no-empty-object-type */

/** Read persisted locale; fall back to Ukrainian. */
const savedLocale = ((): MessageLanguages => {
  try {
    const v = localStorage.getItem('locale') as MessageLanguages | null;
    if (v && v in messages) return v;
  } catch { /* SSR / server-render safety */ }
  return 'uk';
})();

/** Exported so language-switcher components can call i18n.global.locale.value */
export const i18n = createI18n<{ message: MessageSchema }, MessageLanguages>({
  locale: savedLocale,
  fallbackLocale: 'en-US',
  legacy: false,
  globalInjection: true, // makes $t() available in all templates
  messages,
});

export default defineBoot(({ app }) => {
  app.use(i18n);
});
