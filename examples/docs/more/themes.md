# Vzhled a témata

Framework vykresluje formuláře a okna dialogů. Jaké třídy dostanou, určuje téma. CSS framework si nevnucuje.

```ts
// main.ts: rozložení pro každé téma, k tomu vzhled
import '@phloxcz/phlox-js/styles/base.css';
import '@phloxcz/phlox-js/styles/default.css';          // výchozí téma
```

```ts
// nebo s Bootstrapem 5
import '@phloxcz/phlox-js/styles/base.css';
import 'bootstrap/dist/css/bootstrap.min.css';

services.add(new BootstrapTheme());              // services.ts
```

- **Výchozí téma** (bez registrace) dává třídy `phlox-*` a `default.css` jim dává vzhled. Používá systémové barvy prohlížeče jako ostatní komponenty phlox. S `:root { color-scheme: light dark; }` na stránce ztmavne se systémem, bez něj zůstane světlé. Barvy a zaoblení jdou změnit proměnnými `--phlox-error`, `--phlox-radius` a `--phlox-backdrop`.
- **`BootstrapTheme`** dává Bootstrap třídy (`form-control`, `form-select`, `is-invalid`, `invalid-feedback`, `btn btn-primary`...) a o vzhled i tmavý režim se stará Bootstrap: tmavý je s `data-bs-theme="dark"` na `<html>`. `default.css` se nenačítá. `color-scheme` stránky má s `data-bs-theme` souhlasit, jinak budou systémové prvky (zaškrtávátka, posuvníky) tmavé na světlé stránce.
- **`base.css`** je jen rozložení (šířka okna dialogu, skrývání přes `toggle()`), potřebuje ho každé téma.
- **Změna jednotlivých tříd:** `new BootstrapTheme({ formRow: 'row mb-2' })`.
- **Tato dokumentace** má v hlavičce přepínač vzhledu (výchozí, Bootstrap), režimu (podle systému, světlý, tmavý) a animací, který si volbu pamatuje a platí pro všechny ukázky. Kód je v `examples/shared/appearance.tsx` a může posloužit jako vzor pro nastavení v aplikaci. Parametr `?theme=bootstrap` nebo `?theme=default` v URL má přednost.

## Tlačítka

Vlastní tlačítka (v `actions()` dialogu, v seznamu, v layoutu) kresli přes `<Button>`, dostanou třídy tématu:

```tsx
import { Button } from '@phloxcz/phlox-js';

<Button onClick={() => this.close(false)}>Zrušit</Button>
<Button primary disabled={() => this.form.submitting()} onClick={() => this.form.submit()}>Uložit</Button>
<Button danger small onClick={event => this.handleDelete(item(), event.currentTarget)}>Smazat</Button>
```

<!-- demo: themes-buttons -->

- **Varianty:** bez volby vedlejší (Zrušit, Zavřít), `primary` hlavní akce místa, `danger` akce, která něco zničí. `small` je menší.
- **Je to obyčejný `<button>`:** bere všechny jeho atributy a události, `type` je ve výchozím stavu `button` (ne `submit`). `class` se přidá k třídám tématu.
- **Místa tématu:** `buttonPrimary`, `buttonSecondary`, `buttonDanger`, `buttonSmall`. V Bootstrapu `btn btn-primary`, `btn btn-outline-secondary`, `btn btn-danger`, `btn-sm`.

## Animace

Animace frameworku (rozbalování stromu, uhýbání při řazení, otáčení šipek a jiné přechody) mají jeden přepínač:

```ts
import { setMotion } from '@phloxcz/phlox-js';

setMotion('system');   // výchozí: podle nastavení systému „omezit pohyb“
setMotion('on');       // vždy, i když systém žádá omezení
setMotion('off');      // nikdy
```

- **Platí pro všechny prvky,** i budoucí. Volbu uživatele si aplikace uloží sama (třeba do `localStorage`) a při startu ji nastaví.
- **`motion()`** vrací aktuální volbu a je reaktivní, hodí se pro přepínač v nastavení. **`allowsMotion()`** řekne, jestli se teď smí animovat.
- **Vlastní animace** se mohou řídit stejně: v JS se zeptej `allowsMotion()`, v CSS vynásob délku proměnnou `--phlox-motion` (1 nebo 0): `transition: opacity calc(.2s * var(--phlox-motion));`. Proměnnou nastavuje `base.css` podle atributu `data-phlox-motion` na `<html>` a podle nastavení systému.
- **Ukazatele stavu se točí dál,** třeba kolečko načítání ve stromu. Nejsou ozdoba, říkají, že se něco děje.

## Vlastní téma

Téma je mapa „místo → třídy“. Jiný CSS framework (Tailwind, Foundation...) je jen další mapa:

```ts
class FoundationTheme extends Theme {
  constructor() {
    super({ input: '', error: 'form-error is-visible', invalid: 'is-invalid-input', button: 'button' });
  }
}
services.add(new FoundationTheme());
```

| Místo | Kde |
|---|---|
| `form`, `formRow`, `formErrors`, `formButtons` | `<FormView>` |
| `label`, `input`, `select`, `textarea`, `button` | prvky formuláře |
| `buttonPrimary`, `buttonSecondary`, `buttonDanger`, `buttonSmall` | `<Button>` |
| `invalid`, `error` | prvek s chybou, text chyby |
| `checkbox`, `checkboxInput`, `radioList`, `checkboxList`, `choiceItem`, `choiceInput` | checkboxy a výběry |
| `dialog`, `dialogContent`, `dialogHeader`, `dialogTitle`, `dialogClose`, `dialogBody`, `dialogFooter` | okno dialogu |
| `dropdown.button`, `dropdown.panel`, `dropdown.item`, `dropdown.itemActive` | `<Dropdown>`, `<DropdownItem>` |

Místo, které téma nemá, dostane prázdnou třídu. Vlastní prvky si mohou zavést svá místa, třeba `dropdownlist.wrapper`, a číst je přes `currentTheme().class('dropdownlist.wrapper')` (`currentTheme` z `@phloxcz/phlox-js`).
