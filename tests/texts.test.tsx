/** Texts of the framework in another language: setTexts() and the Czech texts in @phloxcz/phlox-js/locales/cs. */
import { describe, expect, test } from 'vitest';
import { tabsTexts } from '../src/ui/tabs';
import { messageTexts, setTexts } from '../src/index';
import type { FrameworkTexts } from '../src/index';
import { texts } from '../src/ui/texts';
import { Grid, Tree } from '../src/components/index';
import { ComboBox, DropDownList, DropDownTreeSelect, Form, Multiplier, TagInput, UploadControl } from '../src/forms/index';
import cs from '../src/locales/cs';

describe('texts', () => {
  test('setTexts() changes the registered texts and those registered later; single ones stay changeable', () => {
    const early = texts('demo-early', { hello: 'Hello', bye: 'Bye' });
    setTexts({ 'demo-early': { hello: 'Ahoj' }, 'demo-late': { hello: 'Nazdar' } } as never);
    expect(early).toEqual({ hello: 'Ahoj', bye: 'Bye' });
    const late = texts('demo-late', { hello: 'Hello' });
    expect(late.hello).toBe('Nazdar');
    late.hello = 'Čau';
    expect(late.hello).toBe('Čau');
  });

  test('the Czech texts translate every text of the framework, also the messages of rules', () => {
    const holders: Record<Exclude<keyof FrameworkTexts, 'rules'>, object> = {
      messages: messageTexts, grid: Grid.texts, tree: Tree.texts, dropdownlist: DropDownList.texts, combobox: ComboBox.texts,
      dropdowntree: DropDownTreeSelect.texts, multiplier: Multiplier.texts, taginput: TagInput.texts, upload: UploadControl.texts,
      tabs: tabsTexts,
    };
    for (const [name, holder] of Object.entries(holders)) expect(Object.keys(cs[name as keyof FrameworkTexts]).sort(), name).toEqual(Object.keys(holder).sort());

    const english = new Map(Form.messages);
    setTexts(cs);
    // No message of a rule is left in English
    expect([...Form.messages].filter(([validator, text]) => english.get(validator) === text)).toEqual([]);
    expect(messageTexts.cancel).toBe('Zrušit');
    expect(Grid.texts.columns).toBe('Sloupce');
    expect(Multiplier.texts.add).toBe('Přidat');
    expect(Form.messages.get(Form.Filled)).toBe('Toto pole je povinné.');
    expect(Form.messages.get(Form.MaxLength)).toBe('Zadejte prosím maximálně %d znaků.');
  });
});
