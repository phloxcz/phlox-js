import { afterEach, describe, expect, test, vi } from 'vitest';
import { allowsMotion, motion, render, setMotion } from '../src/index';
import { slide } from '../src/ui/drag';
import { Tree, TreeView } from '../src/components/index';
import { tick } from './helpers';

/** The system setting to reduce motion, as the browser reports it. */
function systemReduces(reduce: boolean) {
  window.matchMedia = (query: string) => ({ matches: reduce && query.includes('reduce') }) as MediaQueryList;
}

afterEach(() => {
  setMotion('system');
  delete (window as Partial<Window>).matchMedia;
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  document.body.replaceChildren();
});

describe('setMotion', () => {
  test('system by default: animations follow the setting of the system', () => {
    expect(motion()).toBe('system');
    systemReduces(false);
    expect(allowsMotion()).toBe(true);
    systemReduces(true);
    expect(allowsMotion()).toBe(false);
    expect(document.documentElement.hasAttribute('data-phlox-motion')).toBe(false);
  });

  test('on and off override the system, the CSS follows by an attribute of <html>', () => {
    systemReduces(true);
    setMotion('on');
    expect(allowsMotion()).toBe(true);
    expect(document.documentElement.dataset.phloxMotion).toBe('on');
    systemReduces(false);
    setMotion('off');
    expect(allowsMotion()).toBe(false);
    expect(document.documentElement.dataset.phloxMotion).toBe('off');
    setMotion('system');
    expect(document.documentElement.hasAttribute('data-phlox-motion')).toBe(false);
  });

  test('JS animations of the framework ask the setting: sliding items and the tree', async () => {
    const animate = vi.fn(() => ({ onfinish: null, cancel: vi.fn() }));
    HTMLElement.prototype.animate = animate as unknown as HTMLElement['animate'];
    const element = document.createElement('div');

    setMotion('off');
    slide(element, { x: 0, y: 20 });
    expect(animate).not.toHaveBeenCalled();
    setMotion('on');
    slide(element, { x: 0, y: 20 });
    expect(animate).toHaveBeenCalledOnce();

    const tree = new Tree({ nodes: [{ id: 1, label: 'Ovoce', children: [{ id: 2, label: 'Jablka' }] }] });
    const root = document.createElement('div');
    document.body.append(root);
    render(() => <TreeView tree={tree} />, root);
    (root.firstElementChild as HTMLElement).style.setProperty('--pt-anim-duration', '180ms');

    setMotion('off');
    await tree.expand(tree.find(1)!);
    await tick();
    expect(animate).toHaveBeenCalledOnce();
    tree.collapse(tree.find(1)!);

    // On, even when the system asks for less motion
    systemReduces(true);
    setMotion('on');
    await tree.expand(tree.find(1)!);
    await tick();
    expect(animate).toHaveBeenCalledTimes(2);
  });
});
