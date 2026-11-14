/**
 * The WYSIWYG editor of the Phlox ecosystem (phlox-editor, the same as in Nette forms): addEditor() in forms,
 * <Editor> in templates. The editor and its CSS are loaded when the first one is shown, so an application
 * without an editor does not download it.
 */

import type { EditorOptions, PhloxEditor } from '@phloxcz/forms-editor';
import { effect, state, untrack } from '../reactive/reactive';
import type { State } from '../reactive/reactive';
import type { Child, Reactive } from '../ui/dom';
import { Component } from '../ui/component';
import { currentTheme } from '../ui/theme';
import { FormControl } from './controls';
import type { ExtraAttributes } from './controls';

export type { EditorOptions };
/** The running editor: getValue(), setValue(), insertText()… */
export type EditorInstance = PhloxEditor;

type Library = typeof import('@phloxcz/forms-editor');
let loading: Promise<Library> | null = null;

/** The editor library and its CSS, loaded once. */
function loadEditor(): Promise<Library> {
  loading ??= Promise.all([import('@phloxcz/forms-editor'), import('@phloxcz/forms-editor/wysiwyg.css')]).then(([library]) => {
    // The framework makes and destroys the editors, the library need not watch the page
    library.autoInit(false);
    return library;
  });
  return loading;
}

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
export class Editor extends Component<EditorProps> {
  /** Options of every editor of the application, e.g. { upload } or { colorScheme: 'auto' }. Its own options go over them. */
  static defaults: EditorOptions = {};

  /** The editor, null until it is loaded and the element is in the page. */
  editor: EditorInstance | null = null;
  private host!: HTMLElement;
  private theme: 'default' | 'bootstrap' = 'default';

  render() {
    this.theme = currentTheme().editorTheme;
    // The editor adds its own classes to its element, so the reactive class is on the one around it
    return <div class={this.props.class}><div ref={element => { this.host = element; }} /></div>;
  }

  override afterRender() {
    loadEditor().then(
      library => this.scope.disposed || this.create(library),
      error => this.app.onError(error),
    );
  }

  private create(library: Library): void {
    const { value, enabled, options, name, label } = this.props;
    const editor = this.editor = new library.PhloxEditor(this.host, {
      theme: this.theme,
      ...Editor.defaults,
      ...options,
      name: name ?? '',
      value: value ? untrack(value) : '',
    });
    const pane = this.host.querySelector<HTMLElement>('[contenteditable]');
    pane?.setAttribute('role', 'textbox');
    pane?.setAttribute('aria-multiline', 'true');
    if (label) pane?.setAttribute('aria-label', label);

    const changed = (event: Event) => value?.set((event as CustomEvent<{ value: string }>).detail.value);
    this.host.addEventListener('phx-editor:change', changed);
    this.scope.onCleanup(() => {
      this.host.removeEventListener('phx-editor:change', changed);
      editor.destroy();
    });
    this.scope.run(() => {
      // A new value from outside (a reset form, a loaded record); the user's own change is already there
      if (value) effect(() => {
        const next = value() ?? '';
        if (next !== editor.getValue()) editor.setValue(next);
      });
      if (enabled !== undefined) effect(() => {
        const on = Boolean(typeof enabled === 'function' ? enabled() : enabled);
        this.host.inert = !on;
        this.host.classList.toggle('phlox-editor-disabled', !on);
      });
    });
    this.props.onCreate?.(editor, pane);
  }
}

/**
 * The editor as a control of a form, its value is HTML. Made by form.addEditor('text', 'Komentář', options);
 * rules, <Label>, <InputError> and errors from the server work as with the other controls.
 */
export class EditorControl extends FormControl<string> {
  private readonly current = state('');
  /** The editor while it is shown, e.g. for insertText(). */
  editor: EditorInstance | null = null;

  constructor(label = '', private options: EditorOptions = {}) {
    super(label);
  }

  getValue(): string {
    return this.current();
  }

  setValue(value: string): void {
    this.current.set(value ?? '');
  }

  /** Text, or an image, a table… An empty editor gives '', but HTML from elsewhere can be just <p></p>. */
  isFilled(): boolean {
    const html = this.current();
    return /<(img|hr|table|iframe|video)\b/i.test(html) || html.replace(/<[^>]*>|&nbsp;/g, '').trim() !== '';
  }

  render(attributes: ExtraAttributes): Child {
    const { name, onBlur } = this.attrs();
    // A change in the editor is a change by the user: the rules are checked as with other controls
    const value: State<string> = Object.assign(() => this.current(), {
      set: (next: string) => {
        this.current.set(next);
        this.changed();
      },
      update: (change: (value: string) => string) => value.set(change(untrack(this.current))),
    });
    let host: HTMLElement | null = null;
    return (
      <div
        class="phlox-editor-control"
        aria-invalid={() => (this.hasErrors() ? 'true' : null)}
        ref={element => { host = element; }}
        // Leaving the whole editor, not moving to its toolbar or a popup of it
        onFocusout={event => {
          if (host?.contains(event.relatedTarget as Node | null)) return;
          (onBlur as (event: FocusEvent) => void)(event);
        }}
      >
        <Editor
          value={value}
          options={this.options}
          name={name as string}
          label={this.label}
          enabled={() => !this.disabled()}
          class={this.classFor(attributes, 'editor')}
          onCreate={(editor, pane) => {
            this.editor = editor;
            this.element = pane;
            if (pane) pane.id = this.htmlId;
          }}
        />
      </div>
    );
  }
}
