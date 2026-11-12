/**
 * Choosing files, like addUpload() and addMultiUpload() in Nette. The look is taken over from phloxcz/components-upload:
 * a drop zone with a button, and a table of the chosen files. Nothing is uploaded here: the value is the File objects,
 * and onSuccess decides how to send them (chunks over RPC, a stream to REST...).
 */

import { If, For } from '../ui/flow';
import { computed, onCleanup, state } from '../reactive/reactive';
import type { Child } from '../ui/dom';
import { classes, currentTheme } from '../ui/theme';
import { FormControl } from './controls';
import type { ExtraAttributes } from './controls';
import { IMAGE_TYPES, fileChecks, validators } from './rules';

// Icons of phloxcz/components-upload
const UPLOAD_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
const REMOVE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

/** Size for people, like in phloxcz/components-upload: 512 B, 1.5 KB, 3.2 MB. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

/** The same file chosen twice is added once. */
const sameFile = (a: File, b: File): boolean => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

/** One file (File | null) or several (File[]). */
export class UploadControl<T extends File | null | File[]> extends FormControl<T> {
  static texts = {
    dropzone: 'Upload area – click or drop files here',
    heading: 'Drop files here',
    or: 'or',
    browseMultiple: 'Choose files',
    browseSingle: 'Choose a file',
    remove: 'Remove %s',
  };

  readonly files = state<File[]>([]);

  /** The accept attribute, from the rules MimeType and Image, as in Nette. */
  readonly accept = computed(() => this.rules.active().flatMap(({ validator, arg }) => {
    if (validator === validators.Image) return IMAGE_TYPES;
    if (validator === validators.MimeType) return (Array.isArray(arg) ? arg : [arg]).map(String);
    return [];
  }).join(', '));

  constructor(label = '', readonly multiple = false) {
    super(label);
  }

  getValue(): T {
    const files = this.files();
    return (this.multiple ? files : (files[0] ?? null)) as T;
  }

  setValue(value: T): void {
    this.files.set(value === null || value === undefined ? [] : Array.isArray(value) ? [...value] : [value as File]);
  }

  isFilled(): boolean {
    return this.files().length > 0;
  }

  /** Adds chosen or dropped files. A single upload keeps only the last one. The rules are checked at once. */
  addFiles(files: Iterable<File>): void {
    const added = [...files];
    if (!added.length) return;
    if (this.multiple) {
      this.files.update(current => [...current, ...added.filter(file => !current.some(other => sameFile(file, other)))]);
    } else {
      this.files.set([added[0]!]);
    }
    this.edited = true;
    this.validate();
  }

  removeFile(file: File): void {
    this.files.update(current => current.filter(other => other !== file));
    this.changed();
  }

  /** Whether the file meets the rules about one file (size, type), for marking it in the list. */
  isValidFile(file: File): boolean {
    return this.rules.active().every(({ validator, arg }) => fileChecks.get(validator)?.(file, arg) ?? true);
  }

  render(attributes: ExtraAttributes): Child {
    const { id, name, ref, onBlur, required: _required, disabled: _disabled, ...common } = this.attrs();
    const theme = currentTheme();
    const slot = (part: string) => theme.class(`upload.${part}`);
    const texts = UploadControl.texts;
    const dragging = state(false);
    let wrapper: HTMLElement;
    let input: HTMLInputElement;
    const open = () => {
      if (!this.disabled()) input.click();
    };

    return (
      <div
        class={classes('pu-wrapper', slot('wrapper'), attributes.class as string)}
        data-phlox-upload
        ref={element => { wrapper = element; }}
        // Checked when the focus leaves the whole control, not when it goes from the zone to its button
        onFocusout={event => {
          if (wrapper.contains(event.relatedTarget as Node | null)) return;
          (onBlur as (event: FocusEvent) => void)(event);
        }}
      >
        <div
          {...common}
          class={() => classes(
            'pu-dropzone', slot('dropzone'), dragging() ? slot('dropzoneActive') : slot('dropzoneIdle'),
            this.hasErrors() && theme.class('invalid'),
          )}
          role="button"
          tabIndex={0}
          aria-label={texts.dropzone}
          aria-disabled={() => (this.disabled() ? 'true' : null)}
          ref={ref as (element: HTMLElement) => void}
          onClick={open}
          onKeydown={event => {
            if ((event.key !== 'Enter' && event.key !== ' ') || event.target !== event.currentTarget) return;
            event.preventDefault();
            open();
          }}
          onDragover={event => {
            event.preventDefault();
            if (!this.disabled()) dragging.set(true);
          }}
          onDragleave={event => {
            if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) dragging.set(false);
          }}
          onDrop={event => {
            event.preventDefault();
            dragging.set(false);
            if (!this.disabled()) this.addFiles(event.dataTransfer?.files ?? []);
          }}
        >
          <div class="pu-dropzone-icon" aria-hidden="true" ref={element => { element.innerHTML = UPLOAD_ICON; }} />
          <p class="pu-dropzone-hint">
            <strong>{texts.heading}</strong>
            <br />
            <span>{texts.or}</span>
          </p>
          {/* The zone is the button for the keyboard, this one is for the mouse; a click on it goes up to the zone */}
          <button type="button" class={classes('pu-browse-btn', slot('button'))} tabIndex={-1} disabled={this.disabled}>
            {this.multiple ? texts.browseMultiple : texts.browseSingle}
          </button>
          <input
            type="file"
            class="pu-file-input"
            id={id as string}
            name={name as string}
            multiple={this.multiple}
            accept={() => this.accept() || null}
            disabled={this.disabled}
            aria-hidden="true"
            tabIndex={-1}
            ref={element => { input = element; }}
            onClick={event => event.stopPropagation()}
            onChange={() => {
              this.addFiles(input.files ?? []);
              // The same file can be chosen again after it was removed
              input.value = '';
            }}
          />
        </div>

        <If when={() => this.files().length}>
          <table class={classes('pu-table', slot('table'))}>
            <tbody>
              <For each={this.files}>
                {file => (
                  <tr class={() => classes('pu-table-row', this.isValidFile(file) ? slot('row') : slot('rowError'))} data-phlox-upload-file>
                    <td class={classes('pu-cell-name', slot('cellName'))} title={file.name}>
                      {preview(file)}
                      {file.name}
                    </td>
                    <td class={classes('pu-cell-size', slot('cellSize'))}>{formatFileSize(file.size)}</td>
                    <td class={classes('pu-cell-remove', slot('cellRemove'))}>
                      <button
                        type="button"
                        class={classes('pu-row-remove', slot('remove'))}
                        aria-label={texts.remove.replace('%s', file.name)}
                        title={texts.remove.replace('%s', file.name)}
                        disabled={this.disabled}
                        ref={element => { element.innerHTML = REMOVE_ICON; }}
                        onClick={() => this.removeFile(file)}
                      />
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </If>
      </div>
    );
  }
}

/** A small preview of an image. The address is released when the file leaves the list. */
function preview(file: File): Child {
  if (!IMAGE_TYPES.includes(file.type) || typeof URL.createObjectURL !== 'function') return null;
  const url = URL.createObjectURL(file);
  onCleanup(() => URL.revokeObjectURL(url));
  return <img class="pu-thumb" src={url} alt="" />;
}
