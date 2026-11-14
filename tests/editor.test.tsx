/**
 * <Html> and its sanitizer, and addEditor() / <Editor> with the real phlox-editor. jsdom has no
 * execCommand, so the user's typing is a change of the pane and its input event; formatting by the
 * toolbar is checked in the browser, examples/helpdesk.
 */
import { beforeAll, describe, expect, test } from 'vitest';
import { BootstrapTheme, Container, Html, If, Presenter, sanitizeHtml, state } from '../src/index';
import { Form, FormView } from '../src/forms/index';
import { Editor } from '../src/forms/index';
import { boot, tick, until } from './helpers';

describe('sanitizeHtml', () => {
  test('keeps text formatting, links, images and tables', () => {
    const html = '<p><strong>a</strong> <em>b</em> <a href="https://x.cz/">c</a></p><ul><li>d</li></ul>'
      + '<img src="/files/1/a.png" alt="e"><table><tbody><tr><td colspan="2">f</td></tr></tbody></table>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  test('drops scripts, event handlers, dangerous addresses and unknown tags', () => {
    expect(sanitizeHtml('<p onclick="x()">a<script>alert(1)</script></p>')).toBe('<p>a</p>');
    expect(sanitizeHtml('<a href="javascript:alert(1)">a</a><a href=" java\tscript:x">b</a>')).toBe('<a>a</a><a>b</a>');
    expect(sanitizeHtml('<img src="x" onerror="alert(1)"><img src="data:image/svg+xml;base64,PHN2Zz4=">')).toBe('<img src="x"><img>');
    expect(sanitizeHtml('<iframe src="https://evil"></iframe><style>body{}</style><custom>text</custom><!-- c -->')).toBe('text');
    expect(sanitizeHtml('<form><input name="password"></form><svg><script>x</script></svg>')).toBe('');
  });

  test('styles only of the text, classes only on request, links to new windows without opener', () => {
    expect(sanitizeHtml('<span style="color: red; position: fixed; background-image: url(x)">a</span>')).toBe('<span style="color: red">a</span>');
    expect(sanitizeHtml('<p class="position-fixed">a</p>')).toBe('<p>a</p>');
    expect(sanitizeHtml('<p class="lead">a</p>', { classes: true })).toBe('<p class="lead">a</p>');
    expect(sanitizeHtml('<a href="/x" target="_top">a</a>')).toBe('<a href="/x" target="_blank" rel="noopener noreferrer">a</a>');
  });

  test('more tags by options', () => {
    expect(sanitizeHtml('<abbr title="Hypertext">HTML</abbr>')).toBe('HTML');
    expect(sanitizeHtml('<abbr title="Hypertext">HTML</abbr>', { tags: { abbr: [] } })).toBe('<abbr title="Hypertext">HTML</abbr>');
  });

  test('<Html> shows the cleaned HTML and follows its state', async () => {
    const html = state('<p>a<script>x</script></p>');
    class Page extends Presenter {
      render() {
        return <Html html={html} class="text" />;
      }
    }
    const { element } = await boot(Page);
    expect(element.querySelector('.text')!.innerHTML).toBe('<p>a</p>');
    html.set('<p><em>b</em></p>');
    expect(element.querySelector('.text')!.innerHTML).toBe('<p><em>b</em></p>');
  });
});

describe('editor', () => {
  let library: typeof import('@phloxcz/forms-editor');

  beforeAll(async () => {
    library = await import('@phloxcz/forms-editor');
  });

  /** The editor is loaded when it is first shown. */
  const paneOf = async (element: HTMLElement) => {
    await until(() => element.querySelector('[contenteditable]') !== null);
    return element.querySelector<HTMLElement>('[contenteditable]')!;
  };
  /** What the user types: the pane changes and sends input. */
  const type = (pane: HTMLElement, html: string) => {
    pane.innerHTML = html;
    pane.dispatchEvent(new Event('input', { bubbles: true }));
  };

  test('the HTML both ways, normalized; destroyed with its part of the template', async () => {
    const html = state('<p><b>a</b></p>');
    const shown = state(true);
    let made: { destroy(): void } | null = null;
    class Page extends Presenter {
      render() {
        return <If when={shown}><Editor value={html} options={{ toolbar: 'format' }} onCreate={editor => { made = editor; }} /></If>;
      }
    }
    const { element } = await boot(Page, '/', new Container().add(new BootstrapTheme()));
    const pane = await paneOf(element);
    expect(pane.innerHTML).toBe('<p><b>a</b></p>');
    expect(pane.getAttribute('role')).toBe('textbox');
    expect(element.querySelector('.phx-editor-bs-mode')).not.toBeNull();

    type(pane, '<p><b>x</b><b>y</b> <i>z</i><font color="#ff0000">r</font><span>s</span></p>');
    expect(html()).toBe('<p><strong>xy</strong> <em>z</em><span style="color: rgb(255, 0, 0);">r</span>s</p>');

    html.set('<p>from outside</p>');
    expect(pane.innerHTML).toBe('<p>from outside</p>');

    type(pane, '<p><br></p>');
    expect(html()).toBe('');

    let destroyed = false;
    const destroy = made!.destroy.bind(made!);
    made!.destroy = () => { destroyed = true; destroy(); };
    shown.set(false);
    await tick();
    expect(destroyed).toBe(true);
  });

  test('EditorControl: required, the value in getValues(), reset and setDefaults', async () => {
    const form = new Form<{ text: string }>();
    const text = form.addEditor('text', 'Komentář', { toolbar: 'format' }).setRequired('Napište text komentáře.');
    class Page extends Presenter {
      render() {
        return <FormView form={form} />;
      }
    }
    const { element } = await boot(Page, '/', new Container().add(new BootstrapTheme()));
    const pane = await paneOf(element);
    expect(pane.id).toBe(text.htmlId);
    expect(text.element).toBe(pane);

    expect(form.validate()).toBe(false);
    expect(text.errors()).toEqual(['Napište text komentáře.']);

    type(pane, '<p>Ahoj</p>');
    expect(form.getValues()).toEqual({ text: '<p>Ahoj</p>' });
    expect(text.errors()).toEqual([]);
    expect(form.isChanged()).toBe(true);

    form.reset();
    expect(pane.innerHTML).toBe('');
    form.setDefaults({ text: '<p>Uloženo</p>' });
    expect(pane.innerHTML).toBe('<p>Uloženo</p>');
    expect(form.isChanged()).toBe(false);

    text.setDisabled();
    expect(pane.closest<HTMLElement>('.phx-editor-wrapper')!.inert).toBe(true);
    text.setDisabled(false);
    expect(pane.closest<HTMLElement>('.phx-editor-wrapper')!.inert).toBe(false);

    text.setValue('<p><img src="/a.png"></p>');
    expect(text.isFilled()).toBe(true);
    text.setValue('<p>&nbsp;</p>');
    expect(text.isFilled()).toBe(false);
  });

  test('images: upload() gives the address; when it fails and inlineImages is off, nothing is inserted', async () => {
    const html = state('');
    let fail = false;
    const upload = async (file: File) => {
      if (fail) throw new Error('offline');
      return `/files/7/${file.name}`;
    };
    class Page extends Presenter {
      render() {
        return <Editor value={html} options={{ upload, inlineImages: false }} />;
      }
    }
    const { element } = await boot(Page, '/', new Container().add(new BootstrapTheme()));
    const pane = await paneOf(element);
    const paste = (file: File) => {
      const event = new Event('paste', { bubbles: true, cancelable: true });
      Object.assign(event, { clipboardData: { items: [{ type: file.type, getAsFile: () => file }], getData: () => '' } });
      pane.dispatchEvent(event);
    };
    pane.focus();
    paste(new File(['x'], 'photo.png', { type: 'image/png' }));
    expect(pane.querySelector('.phx-editor-img-loading')).not.toBeNull();
    expect(html()).toBe('');   // still uploading: not part of the value
    await tick();
    expect(html()).toBe('<img src="/files/7/photo.png" alt="" class="img-fluid">');

    fail = true;
    paste(new File(['y'], 'other.png', { type: 'image/png' }));
    await tick();
    expect(pane.querySelectorAll('img')).toHaveLength(1);
    expect(pane.querySelector('.phx-editor-img-loading')).toBeNull();
  });

  test('pasted HTML from Word loses its fonts, classes and scripts', () => {
    const word = '<!--StartFragment--><p class="MsoNormal" style="margin:0;font-family:Calibri;color:red">'
      + '<span lang="CS" style="font-size:11pt">a</span><o:p></o:p></p><script>x</script>';
    expect(library.cleanPastedHtml(word)).toBe('<p style="color: red">a</p>');
    expect(library.cleanPastedHtml('<b id="docs-internal-guid-1" style="font-weight:normal"><p>a</p></b>')).toBe('<p>a</p>');
    expect(library.cleanPastedHtml('<a href="javascript:x()" onclick="y()">a</a>')).toBe('<a>a</a>');
  });
});
