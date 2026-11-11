import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Container, FlashMessages } from '../src/index';
import { CapifyFlashMessages } from '../src/adapters/capify/index';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('FlashMessages', () => {
  test('a message disappears after the duration, an error stays', () => {
    const flashes = new FlashMessages();
    flashes.add('Saved.', 'success');
    flashes.add('Server down.', 'error');
    expect(flashes.messages().map(flash => flash.text)).toEqual(['Saved.', 'Server down.']);
    vi.advanceTimersByTime(4999);
    expect(flashes.messages()).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(flashes.messages().map(flash => flash.text)).toEqual(['Server down.']);
    vi.advanceTimersByTime(60_000);
    expect(flashes.messages()).toHaveLength(1);
  });

  test('the duration can be set for one message and for the whole application', () => {
    const flashes = new FlashMessages();
    flashes.duration = 1000;
    flashes.add('short');
    flashes.add('stays', 'info', { duration: 0 });
    flashes.add('longer', 'info', { duration: 3000 });
    vi.advanceTimersByTime(1000);
    expect(flashes.messages().map(flash => flash.text)).toEqual(['stays', 'longer']);
    vi.advanceTimersByTime(2000);
    expect(flashes.messages().map(flash => flash.text)).toEqual(['stays']);
  });

  test('remove() and clear() for a close button', () => {
    const flashes = new FlashMessages();
    const first = flashes.add('a');
    flashes.add('b');
    flashes.remove(first);
    expect(flashes.messages().map(flash => flash.text)).toEqual(['b']);
    flashes.clear();
    expect(flashes.messages()).toEqual([]);
  });
});

describe('CapifyFlashMessages', () => {
  function fakeCapify() {
    const shown: { message: string; options: Record<string, unknown>; closed: boolean }[] = [];
    return {
      shown,
      notify(message: string, options: Record<string, unknown> = {}) {
        const toast = { message, options, closed: false };
        shown.push(toast);
        return { close: () => { toast.closed = true; } };
      },
    };
  }

  test('messages go to Capify.notify with the type, the duration and the common options', () => {
    const capify = fakeCapify();
    const flashes = new CapifyFlashMessages(capify, { position: 'bottom-right', theme: 'bootstrap' });
    flashes.add('Saved.', 'success');
    flashes.add('Server down.', 'error');
    flashes.add('Odd type.', 'whatever', { duration: 1500 });
    expect(capify.shown.map(toast => [toast.message, toast.options])).toEqual([
      ['Saved.', { position: 'bottom-right', theme: 'bootstrap', type: 'success', duration: 5000 }],
      ['Server down.', { position: 'bottom-right', theme: 'bootstrap', type: 'error', duration: 0 }],
      ['Odd type.', { position: 'bottom-right', theme: 'bootstrap', type: 'info', duration: 1500 }],
    ]);
    expect(flashes.messages()).toEqual([]);
  });

  test('remove() and clear() close the toasts', () => {
    const capify = fakeCapify();
    const flashes = new CapifyFlashMessages(capify);
    const first = flashes.add('a');
    flashes.add('b');
    flashes.remove(first);
    expect(capify.shown.map(toast => toast.closed)).toEqual([true, false]);
    flashes.clear();
    expect(capify.shown.map(toast => toast.closed)).toEqual([true, true]);
  });

  test('registered in the container it replaces the default service', () => {
    const capify = fakeCapify();
    const container = new Container().add(new CapifyFlashMessages(capify));
    expect(container.get(FlashMessages)).toBeInstanceOf(CapifyFlashMessages);
  });
});
