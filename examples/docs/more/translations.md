# Překlady

Texty jsou v JSON souboru pro každý jazyk. Aplikace si vytvoří překladač a vyveze z něj funkci `t`:

```ts
// i18n.ts
import { IntlTranslator } from '@phloxcz/phlox-js/localization';
import cs from './locales/cs.json';
import en from './locales/en.json';

export const locales: Record<string, typeof cs> = { cs, en };   // en musí mít stejné klíče jako cs
export const translator = new IntlTranslator('cs', cs);
export const { t, html } = translator;
```

```json
{
  "user": { "greeting": "Ahoj {name}" },
  "cart": {
    "items": { "one": "{count} položka", "few": "{count} položky", "other": "{count} položek" }
  }
}
```

```tsx
t('user.greeting', { name: 'Jano' })   // Ahoj Jano
t('cart.items', { count: 3 })          // 3 položky
t('user.greting')                      // chyba kompilace, takový klíč není

<p>{() => t('cart.items', { count: this.count() })}</p>
```

<!-- demo: translations-demo -->

- **Klíče hlídá kompilátor** podle JSON souboru výchozího jazyka.
- **Plurál** je objekt s tvary `one`, `few`, `many`, `other`. Tvar se vybere podle parametru `count` a pravidel jazyka z `Intl.PluralRules`. `other` je povinný a použije se, když potřebný tvar chybí.
- **Čísla** v parametrech se formátují podle jazyka: `1 234,5` česky, `1,234.5` anglicky.
- **Chybějící text** vrátí klíč a vypíše varování do konzole.
- **`t()` vrací text,** který se do stránky vkládá vždy jako text. Pro texty obsahující HTML je `html()`: `<p>{html('about.text')}</p>`. HTML v překladu se použije, hodnoty parametrů se escapují.
- **Reaktivní je překlad jen ve funkci.** `{t('x')}` se přeloží jednou, `{() => t('x', { count: n() })}` se aktualizuje se stavem.

**Změna jazyka:** texty už vykreslené zůstávají ve starém jazyce, proto se po změně postaví strom znovu. URL zůstane, rozepsané formuláře se ztratí.

```ts
translator.setLocale('en', locales.en);
void this.app.restart();
```

## Texty frameworku

Tlačítka dialogů, grid, prvky formulářů a hlášky pravidel mají výchozí texty anglicky. Česky je přepne jedno volání před startem aplikace:

```ts
import { setTexts } from '@phloxcz/phlox-js';
import cs from '@phloxcz/phlox-js/locales/cs';

setTexts(cs);
```

- **Platí pro všechny části,** i ty, které se načtou později (líně načítaný presenter s gridem). Část, kterou aplikace nepoužívá, se kvůli překladu nestáhne.
- **Hlášky pravidel** jsou ve znění českého Nette, takže formulář na serveru i v prohlížeči hlásí totéž.
- **Jednotlivé texty** jde po `setTexts()` dál měnit: `Form.messages.set(Form.Filled, 'Vyplňte pole %label.')`, `DropDownList.texts.noResults = '…'`.
- **Jiný jazyk** je objekt stejného tvaru, typ `TextsLocale` z `@phloxcz/phlox-js` hlídá názvy částí i textů. Stačí uvést, co se liší: `setTexts({ grid: { search: 'Suchen…' } })`.
- **Při změně jazyka za běhu** zavolej `setTexts()` s novým jazykem a postav obrazovky znovu (`app.restart()`), jako u textů aplikace.

**Jiný překladač:** `Translator` je abstraktní třída s metodou `translate(key, params)`, obdoba `Nette\Localization\Translator`. Služba, která ji potřebuje, si o ni řekne v konstruktoru, a v kontejneru jde `IntlTranslator` nahradit jinou implementací.
