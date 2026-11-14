# Nastavení a šířka sloupců

Nastavení uživatele, které si aplikace pamatuje (šířka sloupce, sbalené menu, zvolený pohled), je `state`, který se při každé změně uloží:

```ts
readonly collapsed = this.preference('nav.collapsed', false);

this.collapsed.update(value => !value);   // uloží se
```

- **Kde se ukládá,** rozhoduje služba `Preferences`. Výchozí `BrowserPreferences` píše do `localStorage` jako JSON pod `phlox.` + klíč. Jiné úložiště (server, `sessionStorage`) je vlastní třída s metodami `get(key)` a `set(key, value)`, zaregistrovaná v kontejneru: `services.add(new ServerPreferences())`. Jen jiná předpona: `services.add(new BrowserPreferences('crm.'))`.
- **Klíč** je společný celé aplikaci, dej mu předponu podle místa: `'tasks.width'`.
- **Zablokované úložiště** (anonymní okno) nevadí, nastavení se jen nezapamatuje.

## Šířka sloupce: `ResizeHandle`

Úchyt na okraji prvku, kterým uživatel mění jeho šířku. Šířka je `state`, s `preference` se tedy rovnou pamatuje:

```tsx
import { ResizeHandle } from 'phlox-js';

readonly width = this.preference('tasks.width', 416);

<section style={() => ({ width: `${this.width()}px` })}>
  …
  <ResizeHandle size={this.width} min={300} max={760} initial={416} label="Šířka seznamu úkolů" />
</section>
```

<!-- demo: preferences-resize -->

- **Patří jako poslední dítě** prvku, jehož šířku mění. `base.css` prvku nastaví `position: relative` a úchyt položí na jeho pravý okraj, s `edge="start"` na levý (prvek pak roste doleva).
- **Ovládání:** tažení myší nebo prstem, Escape během tažení vrátí původní šířku, dvojklik vrátí `initial`. S fokusem na úchytu mění šířku šipky (o 16 px, se Shiftem o 64) a Home a End nastaví `min` a `max`. Čtečky ho znají jako `separator` s hodnotou.
- **Prvek, který se posouvá** (`overflow: auto`), by úchyt posouval s obsahem. Posouvat má jeho vnitřek, ne on sám.
- **Šířku jde dát i do proměnné CSS** a nechat ji rozložení: `style={() => `--list-width: ${this.width()}px`}` a v CSS `flex: 0 1 var(--list-width)`. Na telefonu ji pak media query může přebít.
