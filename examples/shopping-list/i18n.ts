import { IntlTranslator } from 'phlox-js/localization';
import { ComboBox, DropDownList } from 'phlox-js/forms';
import cs from './locales/cs.json';
import en from './locales/en.json';

/** Every language must have the same messages as Czech, the compiler checks it. */
export const locales: Record<string, typeof cs> = { cs, en };

export const translator = new IntlTranslator('cs', cs);
export const { t, html } = translator;

/** Texts of the framework, for the current language. Called again after a change of the language. */
export function translateFramework(): void {
  DropDownList.texts.noResults = t('dropdownlist.noResults');
  DropDownList.texts.filterPlaceholder = t('dropdownlist.search');
  ComboBox.texts.noResults = t('dropdownlist.noResults');
}

translateFramework();
