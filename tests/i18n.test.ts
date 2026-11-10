import { afterEach, describe, expect, test, vi } from 'vitest';
import { IntlTranslator, Translator } from '../src/index';

const cs = {
  hello: 'Ahoj {name}',
  user: { deleted: 'Uživatel smazán' },
  cart: { items: { one: '{count} položka', few: '{count} položky', other: '{count} položek' } },
  total: 'Celkem {amount} Kč',
  contact: 'Napište na <a href="mailto:info@example.com">{name}</a>',
};

const en: typeof cs = {
  hello: 'Hello {name}',
  user: { deleted: 'User deleted' },
  cart: { items: { one: '{count} item', few: '', other: '{count} items' } },
  total: 'Total {amount} CZK',
  contact: 'Write to <a href="mailto:info@example.com">{name}</a>',
};

afterEach(() => vi.restoreAllMocks());

describe('IntlTranslator', () => {
  const translator = new IntlTranslator('cs', cs);
  const { t, html } = translator;

  test('finds a message and fills in parameters', () => {
    expect(t('user.deleted')).toBe('Uživatel smazán');
    expect(t('hello', { name: 'Jano' })).toBe('Ahoj Jano');
    expect(t('hello')).toBe('Ahoj {name}');
  });

  test('chooses the Czech plural form', () => {
    expect(t('cart.items', { count: 1 })).toBe('1 položka');
    expect(t('cart.items', { count: 3 })).toBe('3 položky');
    expect(t('cart.items', { count: 5 })).toBe('5 položek');
    expect(t('cart.items', { count: 0 })).toBe('0 položek');
    // 1,5 is the form "many", which is not given, so "other" is used
    expect(t('cart.items', { count: 1.5 })).toBe('1,5 položek');
  });

  test('formats numbers for the locale', () => {
    expect(t('total', { amount: 1234567.5 })).toBe(`Celkem ${new Intl.NumberFormat('cs').format(1234567.5)} Kč`);
    expect(t('total', { amount: 1234567.5 })).not.toContain('1234567');
  });

  test('a missing message returns its key and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(translator.translate('user.unknown')).toBe('user.unknown');
    expect(translator.translate('user')).toBe('user');
    expect(translator.translate('constructor')).toBe('constructor');
    expect(warn).toHaveBeenCalledTimes(3);
  });

  test('keys are checked by the compiler', () => {
    // @ts-expect-error a typo in the key
    void (() => t('user.delete'));
    // @ts-expect-error a group is not a message
    void (() => t('user'));
    // @ts-expect-error forms of a plural are not messages
    void (() => t('cart.items.one'));
  });

  test('html() keeps HTML of the message and escapes parameters', () => {
    const host = document.createElement('div');
    host.append(html('contact', { name: '<b>Ann</b>' }));
    expect(host.querySelector('a')!.getAttribute('href')).toBe('mailto:info@example.com');
    expect(host.querySelector('b')).toBeNull();
    expect(host.textContent).toBe('Napište na <b>Ann</b>');
  });

  test('translate() never escapes, a text node is safe by itself', () => {
    expect(translator.translate('hello', { name: '<b>' })).toBe('Ahoj <b>');
  });

  test('setLocale switches messages and rules', () => {
    const switched = new IntlTranslator('cs', cs);
    switched.setLocale('en', en);
    expect(switched.t('cart.items', { count: 1 })).toBe('1 item');
    expect(switched.t('cart.items', { count: 3 })).toBe('3 items');
    expect(switched.t('total', { amount: 1234.5 })).toBe('Total 1,234.5 CZK');
  });

  test('is a Translator, so it can be replaced in the container', () => {
    expect(translator).toBeInstanceOf(Translator);
  });
});
