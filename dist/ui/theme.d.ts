/**
 * Themes: which CSS classes the framework puts on the elements it renders (forms, dialogs, controls).
 * A theme is a map from a slot, such as `input`, to classes. Another CSS framework is another map,
 * e.g. a TailwindTheme or a FoundationTheme later, with no change of the components.
 */
/** Slots used by the framework. Own controls and adapters may use more, e.g. `dropdownlist.wrapper`. */
export type ThemeSlot = 'form' | 'formRow' | 'formErrors' | 'formButtons' | 'label' | 'input' | 'select' | 'textarea' | 'button' | 'error' | 'invalid' | 'buttonPrimary' | 'buttonSecondary' | 'buttonDanger' | 'buttonSmall' | 'checkbox' | 'checkboxInput' | 'radioList' | 'checkboxList' | 'choiceItem' | 'choiceInput' | 'dialog' | 'dialogContent' | 'dialogHeader' | 'dialogTitle' | 'dialogClose' | 'dialogBody' | 'dialogFooter' | 'group' | 'legend' | 'multiplier' | 'multiplierRow' | 'multiplierHandle' | 'multiplierFields' | 'multiplierField' | 'multiplierButtons' | 'multiplierButton' | 'multiplierAdd';
export type ThemeClasses = Partial<Record<ThemeSlot, string>> & Record<string, string>;
/** Key under which the application provides its theme to everything it renders. */
export declare const THEME: unique symbol;
export declare class Theme {
    /** Text of the close button of a dialog. Bootstrap draws an icon instead, so it has none. */
    closeText: string;
    /** The look of the WYSIWYG editor (addEditor), a preset of phlox-editor. */
    editorTheme: 'default' | 'bootstrap';
    private classes;
    /** Without arguments it is the default theme. `overrides` change single slots. */
    constructor(classes?: ThemeClasses, overrides?: ThemeClasses);
    /** Classes of the slot, '' when the theme has none. */
    class(slot: ThemeSlot | (string & {})): string;
}
/** Bootstrap 5: the elements get Bootstrap classes and Bootstrap takes care of the look, also of dark mode. */
export declare class BootstrapTheme extends Theme {
    closeText: string;
    editorTheme: 'bootstrap';
    constructor(overrides?: ThemeClasses);
}
/** The theme for what is being rendered now: the one of the running application, or the default one. */
export declare function currentTheme(): Theme;
/** Joins classes and leaves out empty parts: classes('a', error && 'b'). */
export declare function classes(...parts: (string | false | null | undefined)[]): string;
