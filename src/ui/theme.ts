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
  | 'dialog' | 'dialogContent' | 'dialogHeader' | 'dialogTitle' | 'dialogClose' | 'dialogBody' | 'dialogFooter'
  | 'group' | 'legend' | 'multiplier' | 'multiplierRow' | 'multiplierHandle' | 'multiplierFields' | 'multiplierField'
  | 'multiplierButtons' | 'multiplierButton' | 'multiplierAdd';

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
  group: 'phlox-group',
  legend: 'phlox-legend',
  multiplier: 'phlox-multiplier',
  multiplierRow: 'phlox-multiplier-row',
  multiplierHandle: 'phlox-multiplier-handle',
  multiplierFields: 'phlox-multiplier-fields',
  multiplierField: 'phlox-multiplier-field',
  multiplierButtons: 'phlox-multiplier-buttons',
  multiplierButton: 'phlox-button phlox-button-small',
  multiplierAdd: 'phlox-button',
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
  // The same classes as phloxcz/forms-combobox
  'combobox.wrapper': 'combobox-wrapper',
  'combobox.input': 'combobox-input',
  'combobox.dropdown': 'combobox-dropdown',
  'combobox.item': '',
  'combobox.itemActive': 'combobox-active',
  'combobox.itemSelected': 'combobox-selected',
  'combobox.noResults': 'combobox-no-results',
  'combobox.mark': '',
  // The same classes as phloxcz/forms-taginput
  'taginput.wrapper': 'phlox-taginput phlox-taginput--theme-default',
  'taginput.container': 'phlox-taginput__container',
  'taginput.input': 'phlox-taginput__input',
  'taginput.tag': 'phlox-taginput__tag',
  'taginput.tagExisting': 'phlox-tag-existing',
  'taginput.tagNew': 'phlox-tag-new',
  'taginput.tagRemove': 'phlox-taginput__tag-remove',
  'taginput.dropdown': 'phlox-taginput__dropdown',
  'taginput.option': 'phlox-taginput__option',
  'taginput.optionActive': 'phlox-taginput__option--active',
  'taginput.optionNew': 'phlox-taginput__option phlox-taginput__option--new',
  'taginput.focused': 'phlox-taginput--focused',
  'taginput.invalid': 'phlox-invalid',
  // Parts of phloxcz/components-upload; its own classes pu-* are there in every theme
  'upload.wrapper': '',
  'upload.dropzone': 'phlox-upload-dropzone',
  'upload.dropzoneIdle': '',
  'upload.dropzoneActive': 'phlox-upload-dropzone-active',
  'upload.button': 'phlox-button',
  'upload.table': 'phlox-upload-table',
  'upload.row': '',
  'upload.rowError': 'phlox-upload-row-error',
  'upload.cellName': '',
  'upload.cellSize': 'phlox-upload-size',
  'upload.cellRemove': 'phlox-upload-remove-cell',
  'upload.remove': 'phlox-upload-remove',
  // Parts of phloxcz/components-tree; its own classes pt-* are there in every theme
  'tree.root': '',
  'tree.row': '',
  'tree.rowSelected': '',
  'tree.toggle': '',
  'tree.label': '',
  'tree.pick': '',
  treeselect: 'phlox-treeselect-box',
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
      group: 'border rounded p-3 mb-3',
      legend: 'float-none w-auto px-2 mb-0 fs-6 fw-semibold',
      multiplier: 'border rounded p-3 mb-3',
      multiplierRow: 'phlox-multiplier-row d-flex gap-2 align-items-start p-2 mb-2 border rounded bg-body',
      multiplierHandle: 'phlox-multiplier-handle btn btn-sm btn-outline-secondary',
      multiplierFields: 'phlox-multiplier-fields',
      multiplierField: 'phlox-multiplier-field',
      multiplierButtons: 'd-flex gap-1',
      multiplierButton: 'btn btn-sm btn-outline-secondary',
      multiplierAdd: 'btn btn-sm btn-outline-primary',
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
      // The same as THEME_BOOTSTRAP of phloxcz/forms-combobox
      'combobox.wrapper': 'combobox-wrapper position-relative',
      'combobox.input': 'form-control',
      'combobox.dropdown': 'dropdown-menu',
      'combobox.item': 'dropdown-item',
      'combobox.itemActive': 'active',
      'combobox.itemSelected': 'fw-semibold',
      'combobox.noResults': 'dropdown-item disabled text-muted fst-italic',
      'combobox.mark': 'fw-bold bg-transparent p-0',
      // The same as THEME_BOOTSTRAP of phloxcz/forms-taginput
      'taginput.wrapper': 'phlox-taginput phlox-taginput--theme-bootstrap',
      'taginput.container': 'phlox-taginput__container form-control d-flex flex-wrap gap-1 align-items-center',
      'taginput.input': 'phlox-taginput__input border-0 flex-grow-1 bg-transparent p-0',
      'taginput.tag': 'phlox-taginput__tag d-inline-flex align-items-center gap-1 rounded-pill',
      'taginput.tagExisting': 'badge text-bg-primary phlox-tag-existing',
      'taginput.tagNew': 'badge text-bg-success phlox-tag-new',
      'taginput.tagRemove': 'phlox-taginput__tag-remove btn-close btn-close-white',
      'taginput.dropdown': 'phlox-taginput__dropdown dropdown-menu show',
      'taginput.option': 'phlox-taginput__option dropdown-item',
      'taginput.optionActive': 'active',
      'taginput.optionNew': 'phlox-taginput__option phlox-taginput__option--new dropdown-item text-success',
      'taginput.focused': 'phlox-taginput--focused',
      'taginput.invalid': 'is-invalid',
      // The Bootstrap theme of phloxcz/components-upload
      'upload.wrapper': '',
      'upload.dropzone': 'border border-dashed rounded-3 p-4 p-md-5 text-center mb-3',
      'upload.dropzoneIdle': 'border-secondary-subtle text-body-secondary',
      'upload.dropzoneActive': 'border-primary bg-primary-subtle text-primary',
      'upload.button': 'btn btn-primary mt-2',
      'upload.table': 'table table-sm align-middle mb-0 mt-2',
      'upload.row': '',
      'upload.rowError': 'table-danger',
      'upload.cellName': 'text-truncate',
      'upload.cellSize': 'text-end text-nowrap text-body-secondary small',
      'upload.cellRemove': 'text-end',
      'upload.remove': 'btn btn-sm btn-link text-danger p-0 lh-1',
      // The Bootstrap theme of phloxcz/components-tree
      'tree.root': '',
      'tree.row': '',
      'tree.rowSelected': 'active',
      'tree.toggle': 'btn btn-sm btn-link p-0 border-0 text-reset text-decoration-none',
      'tree.label': '',
      // Bootstrap's own look of a checkbox and a radio button, which follows data-bs-theme
      'tree.pick': 'form-check-input mt-0',
      treeselect: 'border rounded p-1',
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
