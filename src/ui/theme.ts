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
  | 'buttonPrimary' | 'buttonSecondary' | 'buttonDanger' | 'buttonSmall'
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
  buttonPrimary: 'phlox-button phlox-button-primary',
  buttonSecondary: 'phlox-button',
  buttonDanger: 'phlox-button phlox-button-danger',
  buttonSmall: 'phlox-button-small',
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
  // Parts of phloxcz/components-grid; its own classes phx-grid-* are there in every theme
  'grid.tableWrapper': 'phx-grid-table-wrapper',
  'grid.table': 'phx-grid-table',
  'grid.thead': '',
  'grid.th': 'phx-grid-th',
  'grid.thSortable': 'phx-grid-sortable',
  'grid.thSorted': 'phx-grid-sorted',
  'grid.thFilterCell': 'phx-grid-filter-th',
  'grid.td': 'phx-grid-td',
  'grid.sortLink': 'phx-grid-sort-link',
  'grid.sortIcon': 'phx-grid-sort-icon',
  'grid.toolbar': 'phx-grid-toolbar',
  'grid.searchGroup': 'phx-grid-search-group',
  'grid.searchInput': 'phlox-input',
  'grid.resetBtn': 'phlox-button',
  'grid.filterInput': 'phlox-input phx-grid-filter-input',
  'grid.filterSelect': 'phlox-select phx-grid-filter-input',
  'grid.filterClear': 'phx-grid-filter-clear-btn',
  'grid.paginationNav': 'phx-grid-pagination',
  'grid.paginationList': 'phx-grid-page-list',
  'grid.pageItem': 'phx-grid-page-item',
  'grid.pageItemActive': 'phx-grid-page-active',
  'grid.pageItemDisabled': 'phx-grid-page-disabled',
  'grid.pageLink': 'phx-grid-page-link',
  'grid.paginationInfo': 'phx-grid-pagination-info',
  'grid.noData': 'phx-grid-no-data',
  'grid.msTrigger': 'phlox-select phx-grid-ms-trigger',
  'grid.msDropdown': 'phx-grid-popup',
  'grid.msItem': 'phx-grid-ms-item',
  'grid.msCheck': '',
  'grid.msApply': 'phlox-button phx-grid-ms-apply',
  'grid.actionPrimary': 'phlox-button phlox-button-small',
  'grid.actionMenuToggle': 'phlox-button phlox-button-small phx-grid-action-toggle',
  'grid.actionMenu': 'phx-grid-popup phx-grid-action-menu',
  'grid.actionMenuItem': 'phx-grid-menu-item',
  'grid.colToggleBtn': 'phlox-button',
  'grid.colToggleDropdown': 'phx-grid-popup',
  'grid.colToggleItem': '',
  'grid.colToggleCheck': '',
  'grid.bulkBar': 'phx-grid-bulk',
  'grid.bulkCount': '',
  'grid.bulkBtn': 'phlox-button phlox-button-small',
  'grid.danger': 'phx-grid-danger',
  'grid.check': '',
  'grid.rowSelected': 'phx-grid-row-selected',
  // alert, confirm, prompt, the popover and toasts, after @phloxcz/capify
  'message.body': 'phlox-message',
  'message.text': 'phlox-message-text',
  'message.input': 'phlox-input phlox-message-input',
  'message.ok': 'phlox-button phlox-button-primary',
  'message.okDanger': 'phlox-button phlox-button-danger',
  'message.cancel': 'phlox-button',
  'message.loading': 'phlox-message-loading',
  'message.spinner': 'phlox-spinner',
  'popover.wrap': 'cap-popover',
  'popover.side': '',
  'popover.arrow': 'cap-popover-arrow',
  'popover.body': '',
  'popover.label': 'cap-pop-label',
  'popover.input': 'cap-pop-input',
  'popover.actions': 'cap-pop-actions',
  'popover.ok': 'cap-pop-btn cap-pop-btn-ok',
  'popover.okDanger': 'cap-pop-btn cap-pop-btn-ok cap-pop-btn-danger',
  'popover.cancel': 'cap-pop-btn cap-pop-btn-cancel',
  'toast.container': '',
  'toast.card': 'cap-notify-card',
  'toast.info': '',
  'toast.success': '',
  'toast.warning': '',
  'toast.error': '',
  'toast.title': 'cap-notify-title',
  'toast.message': 'cap-notify-msg',
  'toast.close': '',
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
      buttonPrimary: 'btn btn-primary',
      buttonSecondary: 'btn btn-outline-secondary',
      buttonDanger: 'btn btn-danger',
      buttonSmall: 'btn-sm',
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
      // The Bootstrap theme of phloxcz/components-grid
      'grid.tableWrapper': 'table-responsive',
      'grid.table': 'table table-hover table-bordered align-middle phx-grid-table',
      'grid.thead': '',
      'grid.th': 'phx-grid-th',
      'grid.thSortable': 'phx-grid-sortable',
      'grid.thSorted': 'phx-grid-sorted',
      'grid.thFilterCell': 'phx-grid-filter-th p-1',
      'grid.td': 'phx-grid-td',
      'grid.sortLink': 'btn btn-link p-0 border-0 d-flex align-items-center gap-1 text-decoration-none text-reset fw-semibold phx-grid-sort-link',
      'grid.sortIcon': 'text-muted small',
      'grid.toolbar': 'd-flex align-items-center mb-2',
      'grid.searchGroup': 'input-group input-group-sm flex-grow-1',
      'grid.searchInput': 'form-control',
      'grid.resetBtn': 'btn btn-sm btn-outline-secondary',
      'grid.filterInput': 'form-control form-control-sm phx-grid-filter-input',
      'grid.filterSelect': 'form-select form-select-sm phx-grid-filter-input',
      'grid.filterClear': 'btn btn-sm btn-link p-0 ms-1 phx-grid-filter-clear',
      'grid.paginationNav': 'd-flex flex-wrap gap-2 align-items-center justify-content-between mt-2',
      'grid.paginationList': 'pagination pagination-sm mb-0',
      'grid.pageItem': 'page-item',
      'grid.pageItemActive': 'active',
      'grid.pageItemDisabled': 'disabled',
      'grid.pageLink': 'page-link',
      'grid.paginationInfo': 'text-muted',
      'grid.noData': 'text-center text-muted py-5',
      'grid.msTrigger': 'form-select form-select-sm text-start phx-grid-ms-trigger',
      'grid.msDropdown': 'dropdown-menu py-1',
      'grid.msItem': 'dropdown-item d-flex align-items-center gap-2 py-1 phx-grid-ms-item',
      'grid.msCheck': 'form-check-input mt-0 flex-shrink-0',
      'grid.msApply': 'btn btn-sm btn-primary w-100',
      'grid.actionPrimary': 'btn btn-sm btn-outline-primary',
      'grid.actionMenuToggle': 'btn btn-sm btn-outline-primary phx-grid-action-toggle',
      'grid.actionMenu': 'phx-grid-action-menu dropdown-menu',
      'grid.actionMenuItem': 'dropdown-item',
      'grid.colToggleBtn': 'btn btn-sm btn-outline-secondary dropdown-toggle phx-grid-coltoggle-toggle',
      'grid.colToggleDropdown': 'dropdown-menu p-2',
      'grid.colToggleItem': 'd-flex align-items-center gap-2 py-1 px-2',
      'grid.colToggleCheck': 'form-check-input mt-0 flex-shrink-0',
      'grid.bulkBar': 'd-flex align-items-center gap-2 px-3 py-2 bg-body-secondary border-bottom',
      'grid.bulkCount': 'fw-semibold text-muted me-1',
      'grid.bulkBtn': 'btn btn-sm btn-outline-secondary',
      'grid.danger': 'text-danger',
      'grid.check': 'form-check-input',
      'grid.rowSelected': 'table-active',
      // alert, confirm, prompt, the popover and toasts with Bootstrap's modal, popover and alert
      'message.body': '',
      'message.text': '',
      'message.input': 'form-control mt-3',
      'message.ok': 'btn btn-primary',
      'message.okDanger': 'btn btn-danger',
      'message.cancel': 'btn btn-outline-secondary',
      'message.loading': 'd-flex align-items-center gap-3',
      'message.spinner': 'spinner-border spinner-border-sm text-primary',
      'popover.wrap': 'popover cap-popover-bs',
      'popover.side': 'bs-popover-%s',
      'popover.arrow': 'popover-arrow',
      'popover.body': 'popover-body',
      'popover.label': 'mb-2',
      'popover.input': 'form-control form-control-sm mb-2',
      'popover.actions': 'd-flex justify-content-end gap-1',
      'popover.ok': 'btn btn-sm btn-primary',
      'popover.okDanger': 'btn btn-sm btn-danger',
      'popover.cancel': 'btn btn-sm btn-outline-secondary',
      'toast.container': '',
      'toast.card': 'alert alert-dismissible shadow-sm mb-0',
      'toast.info': 'alert-info',
      'toast.success': 'alert-success',
      'toast.warning': 'alert-warning',
      'toast.error': 'alert-danger',
      'toast.title': 'alert-heading fw-semibold mb-1 fs-6',
      'toast.message': 'small',
      'toast.close': 'btn-close',
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
