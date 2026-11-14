/**
 * Texts of the framework (buttons of dialogs, the grid, controls of forms, messages of rules) in one place.
 * Every part registers its English defaults under a name; setTexts() puts another language into all of them,
 * also into parts loaded later. A part the application does not use is not downloaded because of it.
 */

import type { Grid } from '../components/grid';
import type { Tree } from '../components/tree';
import type { ComboBox } from '../forms/combobox';
import type { DropDownList } from '../forms/dropdownlist';
import type { DropDownTreeSelect } from '../forms/dropdowntree';
import type { Multiplier } from '../forms/multiplier';
import type { TagInput } from '../forms/taginput';
import type { UploadControl } from '../forms/upload';
import type { messageTexts } from './messages';

type Texts = Record<string, string>;

/** All texts of the framework by the names their parts register under, see setTexts(). */
export interface FrameworkTexts {
  messages: typeof messageTexts;
  grid: typeof Grid.texts;
  tree: typeof Tree.texts;
  dropdownlist: typeof DropDownList.texts;
  combobox: typeof ComboBox.texts;
  dropdowntree: typeof DropDownTreeSelect.texts;
  multiplier: typeof Multiplier.texts;
  taginput: typeof TagInput.texts;
  upload: typeof UploadControl.texts;
  /** Default messages of the rules by their names, like Form.Filled. */
  rules: Record<string, string>;
}

/** A language for setTexts(): any parts and any of their texts. */
export type TextsLocale = { [K in keyof FrameworkTexts]?: Partial<FrameworkTexts[K]> };

const registered = new Map<string, Texts>();
let current: Record<string, Partial<Texts>> = {};

/** Registers the texts of a part of the framework and returns them, in the language set so far. */
export function texts<T extends Texts>(name: string, defaults: T): T {
  registered.set(name, defaults);
  Object.assign(defaults, current[name]);
  return defaults;
}

/**
 * Texts of the framework in another language, before the application starts:
 *
 *   import cs from '@phloxcz/phlox-js/locales/cs';
 *   setTexts(cs);
 *
 * Single texts can be changed afterwards as before: DropDownList.texts.noResults = '…'.
 */
export function setTexts(locale: TextsLocale): void {
  const parts = locale as Record<string, Partial<Texts> | undefined>;
  current = { ...current, ...parts } as Record<string, Partial<Texts>>;
  for (const [name, holder] of registered) Object.assign(holder, parts[name]);
}
