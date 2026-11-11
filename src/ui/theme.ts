/**
 * Themes: which CSS classes the framework puts on the elements it renders (forms, dialogs, controls).
 * A theme is a map from a slot, such as `input`, to classes. Another CSS framework is another map,
 * e.g. a TailwindTheme or a FoundationTheme later, with no change of the components.
 */

import { getScope } from '../reactive/reactive';

/** Slots used by the framework. Own controls and adapters may use more, e.g. `dropdownlist.wrapper`. */
export type ThemeSlot =
  | 'form' | 'formRow' | 'formErrors' | 'formButtons'
  | 'label' | 'input' | 'select' | 'textarea' | 'button' | 'error' | 'invalid'
  | 'checkbox' | 'checkboxInput' | 'radioList' | 'checkboxList' | 'choiceItem' | 'choiceInput'
  | 'dialog' | 'dialogContent' | 'dialogHeader' | 'dialogTitle' | 'dialogClose' | 'dialogBody' | 'dialogFooter';

export type ThemeClasses = Partial<Record<ThemeSlot, string>> & Record<string, string>;

/** Classes of the default theme. Their look is in styles/default.css and uses only system colors. */
const DEFAULT_CLASSES: Record<ThemeSlot, string> & Record<string, string> = {
  form: 'phlox-form',
  formRow: 'phlox-form-row',
  formErrors: 'phlox-form-errors',
  formButtons: 'phlox-form-buttons',
  label: 'phlox-label',
  input: 'phlox-input',
  select: 'phlox-select',
  textarea: 'phlox-textarea',
  button: 'phlox-button',
  error: 'phlox-form-error',
  invalid: 'phlox-invalid',
  checkbox: 'phlox-checkbox',
  checkboxInput: '',
  radioList: 'phlox-radiolist',
  checkboxList: 'phlox-checkboxlist',
  choiceItem: 'phlox-choice',
  choiceInput: '',
  dialog: 'phlox-dialog',
  dialogContent: 'phlox-dialog-content',
  dialogHeader: 'phlox-dialog-header',
  dialogTitle: 'phlox-dialog-title',
  dialogClose: 'phlox-dialog-close',
  dialogBody: 'phlox-dialog-body',
  dialogFooter: 'phlox-dialog-footer',
  // The same classes as phloxcz/forms-dropdownlist, so both look the same
  'dropdownlist.wrapper': 'dropdownlist-wrapper',
  'dropdownlist.trigger': 'dropdownlist-trigger',
  'dropdownlist.dropdown': 'dropdownlist-dropdown',
  'dropdownlist.filterRow': 'dropdownlist-filter',
  'dropdownlist.filterInput': 'dropdownlist-filter-input',
  'dropdownlist.item': '',
  'dropdownlist.itemActive': 'dropdownlist-active',
  'dropdownlist.itemSelected': 'dropdownlist-selected',
  'dropdownlist.noResults': 'dropdownlist-no-results',
  'dropdownlist.mark': '',
};

/** Key under which the application provides its theme to everything it renders. */
export const THEME = Symbol('theme');

export class Theme {
  /** Text of the close button of a dialog. Bootstrap draws an icon instead, so it has none. */
  closeText = '×';
  private classes: Record<string, string>;

  /** Without arguments it is the default theme. `overrides` change single slots. */
  constructor(classes: ThemeClasses = DEFAULT_CLASSES, overrides: ThemeClasses = {}) {
    this.classes = { ...classes, ...overrides };
  }

  /** Classes of the slot, '' when the theme has none. */
  class(slot: ThemeSlot | (string & {})): string {
    return this.classes[slot] ?? '';
  }
}

/** Bootstrap 5: the elements get Bootstrap classes and Bootstrap takes care of the look, also of dark mode. */
export class BootstrapTheme extends Theme {
  override closeText = '';

  constructor(overrides: ThemeClasses = {}) {
    super({
      form: '',
      formRow: 'mb-3',
      formErrors: 'alert alert-danger',
      formButtons: 'd-flex gap-2',
      label: 'form-label',
      input: 'form-control',
      select: 'form-select',
      textarea: 'form-control',
      button: 'btn btn-primary',
      error: 'invalid-feedback d-block',
      invalid: 'is-invalid',
      checkbox: 'form-check',
      checkboxInput: 'form-check-input',
      radioList: '',
      checkboxList: '',
      choiceItem: 'form-check',
      choiceInput: 'form-check-input',
      // Utilities, not modal-*: those take their colors and spacing from variables set only on .modal,
      // which a native <dialog> does not have. phlox-dialog stays for the layout from styles/base.css.
      dialog: 'phlox-dialog border-0 p-0 bg-transparent',
      dialogContent: 'bg-body text-body border rounded-3 shadow',
      dialogHeader: 'd-flex align-items-center gap-3 px-3 py-2 border-bottom',
      dialogTitle: 'h5 mb-0 flex-grow-1',
      dialogClose: 'btn-close',
      dialogBody: 'p-3',
      dialogFooter: 'd-flex justify-content-end gap-2 px-3 py-2 border-top',
      // The same as THEME_BOOTSTRAP of phloxcz/forms-dropdownlist
      'dropdownlist.wrapper': 'dropdownlist-wrapper position-relative',
      'dropdownlist.trigger': 'form-select text-start dropdownlist-bs-trigger',
      'dropdownlist.dropdown': 'dropdown-menu py-0',
      'dropdownlist.filterRow': 'p-3',
      'dropdownlist.filterInput': 'form-control form-control-sm',
      'dropdownlist.item': 'dropdown-item',
      'dropdownlist.itemActive': 'active',
      'dropdownlist.itemSelected': 'fw-semibold',
      'dropdownlist.noResults': 'dropdown-item disabled text-muted fst-italic',
      'dropdownlist.mark': 'fw-bold bg-transparent p-0',
    }, overrides);
  }
}

/** The theme for what is being rendered now: the one of the running application, or the default one. */
export function currentTheme(): Theme {
  return getScope()?.find<Theme>(THEME) ?? defaultTheme;
}

const defaultTheme = new Theme();

/** Joins classes and leaves out empty parts: classes('a', error && 'b'). */
export function classes(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
