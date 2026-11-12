import { afterEach, describe, expect, test, vi } from 'vitest';
import { BootstrapTheme, Container, Presenter, render } from '../src/index';
import type { Child } from '../src/index';
import { Form, FormView, Input, UploadControl, formatFileSize } from '../src/forms/index';
import { fileChunks } from '../src/net/index';
import { boot } from './helpers';

interface Message {
  subject: string;
  photo: File | null;
  attachments: File[];
}

const file = (name: string, size: number, type: string, lastModified = 1) =>
  new File([new Uint8Array(size)], name, { type, lastModified });

function mount(view: () => Child) {
  const root = document.createElement('div');
  document.body.append(root);
  render(view, root);
  return root;
}

/** What the browser does when the user picks files in the dialog. */
function choose(root: HTMLElement, files: File[], index = 0) {
  const input = root.querySelectorAll<HTMLInputElement>('input[type=file]')[index]!;
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** What the browser does when files are dropped on the zone. */
function drop(zone: Element, type: string, files: File[] = []) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files } });
  zone.dispatchEvent(event);
  return event;
}

const names = (root: HTMLElement) => [...root.querySelectorAll('[data-phlox-upload-file] .pu-cell-name')].map(cell => cell.textContent);

afterEach(() => document.body.replaceChildren());

describe('values', () => {
  test('one file is File or null, several are File[], onSuccess gets the File objects', async () => {
    const form = new Form<Message>();
    form.addText('subject');
    const photo = form.addUpload('photo', 'Fotka:');
    const attachments = form.addMultiUpload('attachments', 'Přílohy:');
    expect(form.getValues()).toEqual({ subject: '', photo: null, attachments: [] });

    const a = file('a.txt', 3, 'text/plain');
    const b = file('b.png', 5, 'image/png');
    photo.addFiles([a, b]);
    attachments.addFiles([a, b]);
    const sent = vi.fn();
    form.onSuccess = sent;
    await form.submit();
    expect(sent.mock.calls[0]![0]).toEqual({ subject: '', photo: b, attachments: [a, b] });
    expect(sent.mock.calls[0]![0].photo).toBeInstanceOf(File);

    form.reset();
    expect(form.getValues()).toEqual({ subject: '', photo: null, attachments: [] });
  });

  test('a file chosen twice is added once, a single upload keeps the last one', () => {
    const form = new Form<Message>();
    const photo = form.addUpload('photo');
    const attachments = form.addMultiUpload('attachments');
    const a = file('a.txt', 3, 'text/plain');
    attachments.addFiles([a]);
    attachments.addFiles([file('a.txt', 3, 'text/plain'), file('a.txt', 4, 'text/plain')]);
    expect(attachments.getValue().map(f => f.size)).toEqual([3, 4]);
    photo.addFiles([a]);
    photo.addFiles([file('c.txt', 1, 'text/plain')]);
    expect(photo.getValue()!.name).toBe('c.txt');
  });

  test('types: an upload only for File fields, several only for File[]', () => {
    const form = new Form<Message>();
    // @ts-expect-error subject is a text
    void (() => form.addUpload('subject'));
    // @ts-expect-error photo is one file
    void (() => form.addMultiUpload('photo'));
    // @ts-expect-error attachments are several files
    void (() => form.addUpload('attachments'));
    const value: File | null = form.addUpload('photo').getValue();
    void value;
  });

  test('formatFileSize as in phloxcz/components-upload', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(3.25 * 1048576)).toBe('3.3 MB');
  });
});

describe('rules', () => {
  test('size, type and image are checked for every file, the wrong file is marked in the list', () => {
    const form = new Form<Message>();
    const attachments = form.addMultiUpload('attachments')
      .addRule(Form.MaxFileSize, 'Nejvýš %d B.', 10)
      .addRule(Form.MimeType, 'Jen text nebo obrázek.', ['text/plain', 'image/*']);
    const root = mount(() => <FormView form={form} />);

    choose(root, [file('ok.txt', 5, 'text/plain'), file('big.png', 20, 'image/png')]);
    expect(attachments.errors()).toEqual(['Nejvýš 10 B.']);
    const rows = root.querySelectorAll('[data-phlox-upload-file]');
    expect(rows[0]!.className).toBe('pu-table-row');
    expect(rows[1]!.className).toBe('pu-table-row phlox-upload-row-error');

    rows[1]!.querySelector<HTMLButtonElement>('.pu-row-remove')!.click();
    expect(attachments.errors()).toEqual([]);
    choose(root, [file('doc.pdf', 5, 'application/pdf')]);
    expect(attachments.errors()).toEqual(['Jen text nebo obrázek.']);
  });

  test('Form.Image and the number of files, like in Nette', () => {
    const form = new Form<Message>();
    const photo = form.addUpload('photo').setRequired('Vyberte fotku.').addRule(Form.Image);
    const attachments = form.addMultiUpload('attachments').addRule(Form.MaxLength, 'Nejvýš %d soubory.', 2);
    expect(form.validate()).toBe(false);
    expect(photo.errors()).toEqual(['Vyberte fotku.']);
    photo.addFiles([file('a.svg', 5, 'image/svg+xml')]);
    expect(photo.errors()).toEqual(['The uploaded file must be image in format JPEG, GIF, PNG, WebP or AVIF.']);
    photo.addFiles([file('a.webp', 5, 'image/webp')]);
    expect(photo.errors()).toEqual([]);
    attachments.addFiles([file('1', 1, ''), file('2', 1, ''), file('3', 1, '')]);
    expect(attachments.errors()).toEqual(['Nejvýš 2 soubory.']);
  });

  test('the accept attribute follows MimeType and Image, also in a condition that holds', () => {
    const form = new Form<Message & { onlyImages: boolean }>();
    const only = form.addCheckbox('onlyImages');
    form.addMultiUpload('attachments').addRule(Form.MimeType, null, 'application/pdf')
      .addConditionOn(only, Form.Filled).addRule(Form.Image);
    const root = mount(() => <FormView form={form} />);
    const input = root.querySelector<HTMLInputElement>('input[type=file]')!;
    expect(input.getAttribute('accept')).toBe('application/pdf');
    expect(input.multiple).toBe(true);
    only.setValue(true);
    expect(input.getAttribute('accept')).toBe('application/pdf, image/gif, image/png, image/jpeg, image/webp, image/avif');
  });

  test('a single upload has no accept without rules, and the label leads to the input', () => {
    const form = new Form<Message>();
    form.addUpload('photo', 'Fotka:');
    const root = mount(() => <FormView form={form} />);
    const input = root.querySelector<HTMLInputElement>('input[type=file]')!;
    expect(input.hasAttribute('accept')).toBe(false);
    expect(input.multiple).toBe(false);
    expect(root.querySelector('label')!.htmlFor).toBe(input.id);
    expect(input.name).toBe('photo');
  });
});

describe('the drop zone', () => {
  test('a click or Enter opens the dialog of the browser, a chosen file appears in the table', () => {
    const form = new Form<Message>();
    form.addMultiUpload('attachments');
    const root = mount(() => <FormView form={form} />);
    const zone = root.querySelector<HTMLElement>('.pu-dropzone')!;
    const input = root.querySelector<HTMLInputElement>('input[type=file]')!;
    const opened = vi.spyOn(input, 'click');

    zone.click();
    root.querySelector<HTMLButtonElement>('.pu-browse-btn')!.click();
    zone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    zone.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(opened).toHaveBeenCalledTimes(4);
    expect(zone.getAttribute('role')).toBe('button');
    expect(zone.tabIndex).toBe(0);

    expect(root.querySelector('.pu-table')).toBeNull();
    choose(root, [file('a.txt', 2048, 'text/plain')]);
    expect(names(root)).toEqual(['a.txt']);
    expect(root.querySelector('.pu-cell-size')!.textContent).toBe('2.0 KB');
    expect(input.value).toBe('');
  });

  test('dropping files adds them, the zone shows when something is dragged over it', () => {
    const form = new Form<Message>();
    const attachments = form.addMultiUpload('attachments');
    const root = mount(() => <FormView form={form} />);
    const zone = root.querySelector('.pu-dropzone')!;

    expect(drop(zone, 'dragover').defaultPrevented).toBe(true);
    expect(zone.classList.contains('phlox-upload-dropzone-active')).toBe(true);
    zone.dispatchEvent(new MouseEvent('dragleave', { bubbles: true, relatedTarget: document.body }));
    expect(zone.classList.contains('phlox-upload-dropzone-active')).toBe(false);

    drop(zone, 'dragover');
    const event = drop(zone, 'drop', [file('a.txt', 1, 'text/plain'), file('b.txt', 1, 'text/plain')]);
    expect(event.defaultPrevented).toBe(true);
    expect(zone.classList.contains('phlox-upload-dropzone-active')).toBe(false);
    expect(attachments.getValue().map(f => f.name)).toEqual(['a.txt', 'b.txt']);
    expect(names(root)).toEqual(['a.txt', 'b.txt']);
  });

  test('leaving the whole control checks it once the user has chosen, a disabled one takes nothing', () => {
    const form = new Form<Message>();
    const photo = form.addUpload('photo').setRequired('Vyberte fotku.');
    const root = mount(() => <FormView form={form} />);
    const zone = root.querySelector<HTMLElement>('.pu-dropzone')!;

    // Only passing through by Tab says nothing yet
    zone.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
    expect(photo.errors()).toEqual([]);
    choose(root, [file('a.png', 1, 'image/png')]);
    photo.setValue(null);
    zone.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
    expect(photo.errors()).toEqual(['Vyberte fotku.']);
    expect(zone.getAttribute('aria-invalid')).toBe('true');
    expect(zone.classList.contains('phlox-invalid')).toBe(true);

    photo.setDisabled();
    drop(zone, 'drop', [file('a.png', 1, 'image/png')]);
    expect(photo.getValue()).toBeNull();
    expect(zone.getAttribute('aria-disabled')).toBe('true');
  });

  test('the remove button names the file', () => {
    const form = new Form<Message>();
    form.addMultiUpload('attachments');
    const root = mount(() => <FormView form={form} />);
    choose(root, [file('smlouva.pdf', 1, 'application/pdf')]);
    const remove = root.querySelector('.pu-row-remove')!;
    expect(remove.getAttribute('aria-label')).toBe('Remove smlouva.pdf');
    expect(remove.querySelector('svg')).not.toBeNull();
    UploadControl.texts.remove = 'Odebrat %s';
    try {
      const again = mount(() => <FormView form={form} />);
      expect(again.querySelector('.pu-row-remove')!.getAttribute('aria-label')).toBe('Odebrat smlouva.pdf');
    } finally {
      UploadControl.texts.remove = 'Remove %s';
    }
  });

  test('Bootstrap: the classes of phloxcz/components-upload', async () => {
    const form = new Form<Message>();
    const attachments = form.addMultiUpload('attachments').addRule(Form.MaxFileSize, null, 1);
    attachments.addFiles([file('big.txt', 5, 'text/plain')]);
    class Page extends Presenter {
      render() { return <Input control={attachments} />; }
    }
    const { element } = await boot(Page, '/', new Container().add(new BootstrapTheme()));
    expect(element.querySelector('.pu-dropzone')!.className)
      .toBe('pu-dropzone border border-dashed rounded-3 p-4 p-md-5 text-center mb-3 border-secondary-subtle text-body-secondary is-invalid');
    expect(element.querySelector('.pu-browse-btn')!.className).toBe('pu-browse-btn btn btn-primary mt-2');
    expect(element.querySelector('.pu-table')!.className).toBe('pu-table table table-sm align-middle mb-0 mt-2');
    expect(element.querySelector('[data-phlox-upload-file]')!.className).toBe('pu-table-row table-danger');
  });
});

describe('fileChunks', () => {
  test('parts in base64 that make up the file again', async () => {
    const bytes = Uint8Array.from({ length: 2500 }, (_, index) => index % 256);
    const parts = [];
    for await (const chunk of fileChunks(new Blob([bytes]), 1000)) parts.push(chunk);
    expect(parts.map(({ index, total, offset }) => [index, total, offset])).toEqual([[0, 3, 0], [1, 3, 1000], [2, 3, 2000]]);
    const joined = Uint8Array.from(parts.flatMap(part => [...atob(part.data)].map(char => char.charCodeAt(0))));
    expect(joined).toEqual(bytes);
  });

  test('an empty file is one empty part', async () => {
    const parts = [];
    for await (const chunk of fileChunks(new Blob([]))) parts.push(chunk);
    expect(parts).toEqual([{ index: 0, total: 1, offset: 0, data: '' }]);
  });
});
