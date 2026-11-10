import { IntlTranslator } from 'phlox-js/localization';
import cs from './locales/cs.json';
import en from './locales/en.json';

/** Every language must have the same messages as Czech, the compiler checks it. */
export const locales: Record<string, typeof cs> = { cs, en };

export const translator = new IntlTranslator('cs', cs);
export const { t, html } = translator;
