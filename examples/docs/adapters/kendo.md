# Kendo UI

Adaptér `@phloxcz/phlox-js/adapters/kendo` napojí Kendo UI for jQuery, podobně jako knockout-kendo v Knockoutu: widgety svázané se `state`, zničené spolu se svou částí šablony, Kendo Grid, dialogy v Kendo Window a widgety jako prvky formulářů.

**PhloxJS na Kendu nezávisí,** ani při vývoji: Kendo je placená knihovna a licenci má aplikace, která ho používá. Proto tu není živá ukázka. Adaptér testují testy s náhradou Kenda stejného tvaru (`tests/kendo.test.tsx`), se skutečným Kendem ho ověřuje aplikace, která ho nasadí.

## Zapojení

`@phloxcz/phlox-js` Kendo neimportuje, aplikace ho adaptéru předá. Kendo hledá jQuery ve `window`, proto se nastaví před importem Kenda:

```ts
// main.ts
import '@progress/kendo-theme-bootstrap/dist/bootstrap-main.css';
import '@phloxcz/phlox-js/adapters/kendo/kendo.css';
import jQuery from 'jquery';
import { setScriptKey } from '@progress/kendo-licensing';

setScriptKey(import.meta.env.VITE_KENDO_LICENSE);     // licenční klíč z .env.local, ne z gitu
Object.assign(window, { jQuery, $: jQuery });
const { default: kendo } = await import('@progress/kendo-ui');

// services.ts
services.add(new Kendo(kendo), KendoDialogs);          // KendoDialogs: dialogy v Kendo Window
```

- **Licence:** bez klíče Kendo funguje, ale ukazuje upozornění zkušební verze a vodoznak. Klíč patří do `.env.local` (`VITE_KENDO_LICENSE=…`), soubory `*.local` git ignoruje.
- **Typy Kenda** jsou globální jmenný prostor, ne modul. Pro `import()` stačí v projektu deklarace modulu:

  ```ts
  // kendo.d.ts
  declare module '@progress/kendo-ui' {
    const kendo: import('@phloxcz/phlox-js/adapters/kendo').KendoLike & { culture(name: string): void };
    export default kendo;
  }
  ```

## Widget v šabloně: `KendoWidget`

```tsx
import { KendoWidget } from '@phloxcz/phlox-js/adapters/kendo';

public readonly status = state<string>('');

<KendoWidget widget="DropDownList" value={this.status} enabled={() => !this.saving()}
  options={{ dataSource: statuses, dataTextField: 'text', dataValueField: 'value' }} />
```

- **`widget`** je název v `kendo.ui` (`DatePicker`, `DropDownList`, `Editor`, `Upload`…), **`options`** jeho volby z dokumentace Kenda. Čtou se jednou, při vytvoření widgetu.
- **`value`** je `state` v obou směrech: změna stavu nastaví widget, změna ve widgetu nastaví stav. Data se porovnávají podle času, seznamy podle obsahu.
- **`enabled`** je stav nebo funkce. **`onCreate(widget, element)`** dá widget pro jeho vlastní metody a události.
- **Widget vznikne,** až je prvek ve stránce, na `<input>` u widgetů hodnot, jinak na `<div>` (jinak `tag`). Když jeho část šablony zmizí (`<If>`, řádek `<For>`, zavřený dialog), zavolá se `destroy()` a nezůstane po něm nic, ani obaly, které si Kendo kolem prvku přidá.

## Kendo Grid: `KendoGrid`

```tsx
<KendoGrid<Order>
  data={this.shown}                                     // state nebo computed s řádky
  options={{ sortable: true, pageable: { pageSize: 10 }, dataSource: { pageSize: 10 } }}
  columns={[
    { field: 'id', title: 'Číslo' },
    { field: 'customer', title: 'Zákazník', render: order => <a href={this.link('edit', { id: order.id })}>{order.customer}</a> },
    { field: 'price', title: 'Cena', format: '{0:n0} Kč' },
  ]}
  onSelect={order => this.selected.set(order)}          // s options.selectable
/>
```

- **`data`** se sleduje: změna stavu (hledání, filtr mimo grid, uložená změna) ukáže nové řádky a grid si nechá řazení i stránkování. Pro data ze serveru dej `options.dataSource` s `transport` jako v Kendu a `data` vynech.
- **`render`** u sloupce kreslí buňku šablonou frameworku místo HTML řetězce Kenda: odkazy, které aplikace zachytí, komponenty, reaktivní text. Při každém překreslení řádků se staré buňky uklidí.
- **Ostatní volby sloupců** (`template`, `format`, `attributes`, `width`…) jsou Kenda beze změny.
- **`onSelect`** dostane řádek jako objekt z `data`, ne kopii, kterou si Kendo dělá.

## Dialogy v Kendo Window: `KendoDialogs`

S `KendoDialogs` v kontejneru se každý dialog frameworku otevře v Kendo Window: `openDialog()`, dialogy rout i `alert`, `confirm` a `prompt`. Komponenty se nemění, `title()` je titulek okna, `render()` obsah, `actions()` tlačítka dole. × a Escape v okně volají `cancel()`, takže se zeptají na neuložené změny. `placement: 'end'` nebo `'start'` dá okno jako panel u okraje přes celou výšku.

## Widget jako prvek formuláře: `KendoControl`

```ts
this.form.addControl('date', new KendoControl<Date>('DatePicker', 'Datum', { format: 'd. M. yyyy' }))
  .setRequired('Vyberte datum.');
this.form.addControl('status', new KendoControl<Status>('DropDownList', 'Stav', { dataSource: statuses, dataTextField: 'text', dataValueField: 'value' }));
```

- **Chová se jako prvky frameworku:** pravidla, `<Label>` (vede na pole widgetu), chyby u pole i ze serveru, `setDefaults`, `isChanged()`, `setDisabled()`, kontrola po opuštění celého widgetu.
- **Hodnota** je to, co dává `value()` widgetu: `Date` u DatePickeru, číslo u NumericTextBoxu, hodnota položky u DropDownListu.
- **Chybné pole** dostane třídu tématu (`is-invalid` v Bootstrapu, `phlox-invalid` ve výchozím) a `kendo.css` mu obarví rámeček.
