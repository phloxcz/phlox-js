/**
 * The WYSIWYG editor of the Phlox ecosystem (phlox-editor, the same as in Nette forms): addEditor() in forms,
 * <Editor> in templates. The editor and its CSS are loaded when the first one is shown, so an application
 * without an editor does not download it.
 */
import type { EditorOptions, PhloxEditor } from '@phloxcz/forms-editor';
import type { State } from '../reactive/reactive';
import type { Child, Reactive } from '../ui/dom';
import { Component } from '../ui/component';
import { FormControl } from './controls';
import type { ExtraAttributes } from './controls';
export type { EditorOptions };
/** The running editor: getValue(), setValue(), insertText()… */
export type EditorInstance = PhloxEditor;
export interface EditorProps {
    /** The HTML, both ways. */
    value?: State<string>;
    options?: EditorOptions;
    enabled?: Reactive<boolean>;
    name?: string | null;
    class?: Reactive<string | null | undefined>;
    /** A name for screen readers, when no <label> is next to it. */
    label?: string;
    onCreate?: (editor: EditorInstance, pane: HTMLElement | null) => void;
}
/** <Editor value={text} options={{ toolbar: 'format,lists' }} />: HTML bound to state both ways. */
export declare class Editor extends Component<EditorProps> {
    /** Options of every editor of the application, e.g. { upload } or { colorScheme: 'auto' }. Its own options go over them. */
    static defaults: EditorOptions;
    /** The editor, null until it is loaded and the element is in the page. */
    editor: EditorInstance | null;
    private host;
    private theme;
    render(): Child;
    afterRender(): void;
    private create;
}
/**
 * The editor as a control of a form, its value is HTML. Made by form.addEditor('text', 'Komentář', options);
 * rules, <Label>, <InputError> and errors from the server work as with the other controls.
 */
export declare class EditorControl extends FormControl<string> {
    private options;
    private readonly current;
    /** The editor while it is shown, e.g. for insertText(). */
    editor: EditorInstance | null;
    /** focus() came before the editor was loaded: it gets the focus once it is there. */
    private focusWhenReady;
    constructor(label?: string, options?: EditorOptions);
    getValue(): string;
    setValue(value: string): void;
    /** The editor is loaded lazily: focus() before that puts the focus in as soon as it is made. */
    focus(): void;
    /** Text, or an image, a table… An empty editor gives '', but HTML from elsewhere can be just <p></p>. */
    isFilled(): boolean;
    render(attributes: ExtraAttributes): Child;
}
