import { describe, expect, test, vi } from 'vitest';
import { render } from '../src/ui/dom';
import type { Child } from '../src/ui/dom';
import { state } from '../src/reactive/reactive';

function mount(view: () => Child): { root: HTMLElement; dispose: () => void } {
  const root = document.createElement('div');
  const dispose = render(view, root);
  return { root, dispose };
}

const text = (root: Node) => root.textContent;

describe('attributes (regressions from TraceJS)', () => {
  test('disabled={false} leaves the element enabled', () => {
    const { root } = mount(() => <button disabled={false}>x</button>);
    expect(root.querySelector('button')!.disabled).toBe(false);
    expect(root.querySelector('button')!.hasAttribute('disabled')).toBe(false);
  });

  test('disabled={true} disables, reactively as well', () => {
    const off = state(true);
    const { root } = mount(() => <button disabled={off}>x</button>);
    const button = root.querySelector('button')!;
    expect(button.disabled).toBe(true);
    off.set(false);
    expect(button.disabled).toBe(false);
  });

  test('false is kept where it is a value', () => {
    const { root } = mount(() => <div aria-hidden={false} draggable={false} data-open={false} />);
    const div = root.querySelector('div')!;
    expect(div.getAttribute('aria-hidden')).toBe('false');
    expect(div.getAttribute('draggable')).toBe('false');
    expect(div.getAttribute('data-open')).toBe('false');
  });

  test('null and undefined remove the attribute, 0 and empty text stay', () => {
    const title = state<string | null>('a');
    const { root } = mount(() => <input title={title} maxLength={0} placeholder="" />);
    const input = root.querySelector('input')!;
    expect(input.getAttribute('maxlength')).toBe('0');
    expect(input.getAttribute('placeholder')).toBe('');
    title.set(null);
    expect(input.hasAttribute('title')).toBe(false);
  });

  test('class and style', () => {
    const cls = state('a');
    const color = state('red');
    const { root } = mount(() => <div class={cls} style={() => ({ color: color() })} />);
    const div = root.querySelector('div')!;
    cls.set('b');
    color.set('blue');
    expect(div.className).toBe('b');
    expect(div.style.color).toBe('blue');
  });

  test('value and checked are properties', () => {
    const value = state('a');
    const checked = state(false);
    const { root } = mount(() => (
      <div>
        <input value={value} />
        <input type="checkbox" checked={checked} />
      </div>
    ));
    const [input, box] = root.querySelectorAll('input');
    input!.value = 'typed by the user';
    value.set('b');
    expect(input!.value).toBe('b');
    checked.set(true);
    expect(box!.checked).toBe(true);
  });

  test('a select takes its value after its options exist', () => {
    const { root } = mount(() => (
      <select value="b">
        <option value="a">A</option>
        <option value="b">B</option>
      </select>
    ));
    expect(root.querySelector('select')!.value).toBe('b');
  });

  test('ref receives the element', () => {
    let element: HTMLInputElement | undefined;
    mount(() => <input ref={el => { element = el; }} />);
    expect(element).toBeInstanceOf(HTMLInputElement);
  });
});

describe('children', () => {
  test('0 is rendered, false, null and undefined are not', () => {
    const { root } = mount(() => <div>{0}{false}{null}{undefined}{true}</div>);
    expect(text(root)).toBe('0');
  });

  test('text is never parsed as HTML', () => {
    const { root } = mount(() => <div>{'<b>x</b>'}</div>);
    expect(root.querySelector('b')).toBeNull();
    expect(text(root)).toBe('<b>x</b>');
  });

  test('a fragment keeps its children (regression from TraceJS)', () => {
    const { root } = mount(() => <div><><span>a</span><><span>b</span></></></div>);
    expect(root.querySelectorAll('span')).toHaveLength(2);
  });

  test('a reactive text updates the same node', () => {
    const count = state(1);
    const { root } = mount(() => <div>{count}</div>);
    const node = [...root.querySelector('div')!.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
    count.set(2);
    expect(node!.textContent).toBe('2');
    expect(text(root)).toBe('2');
  });

  test('a reactive child switches between text, element, fragment and nothing', () => {
    const value = state<'text' | 'element' | 'fragment' | 'nothing'>('text');
    const { root } = mount(() => (
      <div>
        before
        {() => {
          switch (value()) {
            case 'text': return 'text';
            case 'element': return <b>element</b>;
            case 'fragment': return <><i>1</i><i>2</i></>;
            case 'nothing': return null;
          }
        }}
        after
      </div>
    ));
    expect(text(root)).toBe('beforetextafter');
    value.set('element');
    expect(root.querySelector('b')).not.toBeNull();
    value.set('fragment');
    expect(root.querySelector('b')).toBeNull();
    expect(root.querySelectorAll('i')).toHaveLength(2);
    value.set('nothing');
    expect(text(root)).toBe('beforeafter');
    value.set('text');
    expect(text(root)).toBe('beforetextafter');
  });

  test('a region inside a fragment keeps working after the fragment is inserted', () => {
    const count = state(1);
    const { root } = mount(() => <div><>{count}</></div>);
    count.set(2);
    expect(text(root)).toBe('2');
  });
});

describe('templates', () => {
  test('nothing is created until the template is inserted', () => {
    const body = vi.fn();
    const ref = vi.fn();
    const Part = () => {
      body();
      return <i />;
    };
    const view = <div ref={ref}><Part /></div>;
    expect(body).not.toHaveBeenCalled();
    expect(ref).not.toHaveBeenCalled();
    mount(() => view);
    expect(body).toHaveBeenCalledTimes(1);
    expect(ref).toHaveBeenCalledTimes(1);
  });

  test('every insertion is a new instance', () => {
    const item = <b>x</b>;
    const { root } = mount(() => <div>{item}{item}</div>);
    expect(root.querySelectorAll('b')).toHaveLength(2);
  });
});

describe('function components (regression from TraceJS)', () => {
  test('receive props and children', () => {
    const Box = (props: { title: string; children?: Child }) => <section title={props.title}>{props.children}</section>;
    const { root } = mount(() => <Box title="t"><b>a</b><b>b</b></Box>);
    expect(root.querySelector('section')!.title).toBe('t');
    expect(root.querySelectorAll('b')).toHaveLength(2);
  });

  test('reading state in the body does not rerun the parent region', () => {
    const count = state(0);
    const body = vi.fn();
    const Show = () => {
      body(count());
      return <i />;
    };
    const parent = state(0);
    mount(() => <div>{() => { parent(); return <Show />; }}</div>);
    count.set(1);
    expect(body).toHaveBeenCalledTimes(1);
    parent.set(1);
    expect(body).toHaveBeenCalledTimes(2);
  });
});

describe('events and cleanup', () => {
  test('a handler is called and removed with the view', () => {
    const click = vi.fn();
    const { root, dispose } = mount(() => <button onClick={click}>x</button>);
    const button = root.querySelector('button')!;
    button.click();
    expect(click).toHaveBeenCalledTimes(1);
    dispose();
    button.click();
    expect(click).toHaveBeenCalledTimes(1);
  });

  test('a removed branch is cleaned up automatically, no teardown written by the view', () => {
    const show = state(true);
    const count = state(0);
    const read = vi.fn(() => count());
    const click = vi.fn();
    let button: HTMLButtonElement | undefined;
    mount(() => (
      <div>
        {() => show() ? <button ref={el => { button = el; }} onClick={click} title={() => String(read())} /> : null}
      </div>
    ));
    show.set(false);
    read.mockClear();
    count.set(1);
    button!.click();
    expect(read).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  test('dispose removes the view and stops updates', () => {
    const count = state(0);
    const read = vi.fn(() => count());
    const { root, dispose } = mount(() => <div>{read}</div>);
    dispose();
    expect(root.childNodes).toHaveLength(0);
    read.mockClear();
    count.set(1);
    expect(read).not.toHaveBeenCalled();
  });

  test('a failing view leaves nothing in the page and no running effects (regression from TraceJS)', () => {
    const count = state(0);
    const read = vi.fn(() => count());
    const Broken = (): Child => { throw new Error('boom'); };
    const root = document.createElement('div');
    expect(() => render(() => <div title={() => String(read())}><Broken /></div>, root)).toThrow('boom');
    expect(root.childNodes).toHaveLength(0);
    expect(read).not.toHaveBeenCalled();
    const other = vi.fn(() => count());
    expect(() => render(() => [<div title={() => String(other())} />, <Broken />], root)).toThrow('boom');
    expect(root.childNodes).toHaveLength(0);
    other.mockClear();
    count.set(1);
    expect(other).not.toHaveBeenCalled();
  });
});
