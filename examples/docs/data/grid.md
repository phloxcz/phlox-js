# Grid

Tabulka dat jako [phloxcz/components-grid](https://github.com/phloxcz/components-grid), se stejným HTML, třídami a CSS. Importuje se z `@phloxcz/phlox-js/components`. Model (`Grid`) a vykreslení (`<GridView>`) jsou zvlášť jako u formuláře a stromu.

```tsx
import { Grid, GridView } from '@phloxcz/phlox-js/components';

class OrdersPresenter extends Presenter {
  public override routes: Route[] = [
    { name: 'default', pattern: '/' },
    { name: 'detail', pattern: '/<id \\d+>', dialog: ({ id }) => [OrderDetail, { id: Number(id) }] },
  ];

  public grid = new Grid<Order>({
    load: query => this.api.call('order.query', { query }),   // { page, pageSize, sort, search, filter } → { data, total }
    pageSize: 20,
    pageSizes: [10, 20, 50],
    remember: 'orders',
  });

  public constructor(private api: RpcApi) {
    super();
    this.grid.addNumberColumn('id', 'Číslo').sortable();
    this.grid.addTextColumn('customer', 'Zákazník').sortable().filterable();
    this.grid.addTextColumn('category', 'Kategorie').filterSelect(categories, true);
    this.grid.addNumberColumn('price', 'Cena').sortable().filterable().format(price => money.format(price)).aggregate('sum');
    this.grid.addDateColumn('created', 'Vytvořeno').sortable().filterable();
    this.grid.addBoolColumn('paid', 'Zaplaceno').filterable();
    this.grid.addColumn('product', 'Produkt', order => <a href={this.link('detail', { id: order.id })}>{order.product}</a>);

    this.grid.addAction('Detail', { href: order => this.link('detail', { id: order.id }), primary: true });
    this.grid.addAction('Smazat', { onClick: order => this.api.call('order.delete', { id: order.id }), danger: true, confirm: 'Smazat?' });
    this.grid.addBulkAction('Smazat vybrané', ids => this.api.call('order.deleteMany', { ids }), { confirm: 'Smazat vybrané?' });

    this.grid.bind(this);   // stav v URL
  }

  public render() {
    return <GridView grid={this.grid} search resizable reorderable columnToggle aria-label="Objednávky" />;
  }
}
```

<!-- demo: grid-orders -->

## Data

- **Ze serveru:** `load(query)` dostane dotaz ve formátu [phloxcz/api-query](https://github.com/phloxcz/api-query) (stejný jako Kendo UI) a vrátí `{ data, total }`. Odpověď phlox-api-query jde do gridu rovnou, bez převodu:

  ```json
  { "page": 2, "pageSize": 20, "sort": [{ "field": "price", "dir": "desc" }], "search": "fénix",
    "filter": { "logic": "and", "filters": [{ "field": "category", "operator": "in", "value": ["Knihy", "Sport"] },
                                            { "field": "price", "operator": "gte", "value": 100 }] },
    "aggregate": [{ "field": "price", "aggregate": "sum" }] }
  ```

- **V prohlížeči:** `rows: orders` (pole, nebo funkce, která ho vrátí). Grid hledá, filtruje, řadí, sčítá a stránkuje sám, stejnými pravidly. Tytéž pravidla nabízí `applyQuery(rows, query, searchIn)`, třeba pro testovací server.
<!-- demo: grid-local -->

- **Starší odpověď nikdy nepřepíše novější.** Stránka za koncem (třeba po smazání posledních řádků) přejde na poslední.
- **`grid.load()`** načte znovu, třeba po změně dat jinde. Akce na řádku a hromadné akce načítají samy.
- **Klíč řádku** je pole `id`, jiné nastaví volba `key`.

## Sloupce

| Metoda | Sloupec |
|---|---|
| `addTextColumn(key, label)` | text |
| `addNumberColumn(key, label)` | číslo, zarovnané doprava, s oddělením tisíců |
| `addDateColumn(key, label)` | datum `RRRR-MM-DD` nebo datum a čas ISO 8601, jak je posílá API |
| `addBoolColumn(key, label)` | ano a ne jako ✓ a – |
| `addColumn(key, label, row => …)` | vlastní obsah buňky, jakákoli šablona |

Názvy sloupců hlídá kompilátor podle typu řádku. Nastavení se řetězí:

- **`.sortable()`:** klik na záhlaví řadí vzestupně, sestupně a pak vůbec, jako v PHP. Záhlaví má `aria-sort`.
- **`.filterable()`:** filtr podle druhu sloupce. Text hledá podřetězec (`contains`), číslo a datum mají rozsah od–do (`gte`, `lte`), ano a ne výběr. **`.filterSelect(items)`** pevné možnosti (`eq`), **`.filterSelect(items, true)`** několik naráz (`in`). **`.filterDropDown({ search, label })`** možnosti ze serveru přes DropDownList s hledáním.
- **`.searchable()`:** sloupec prohledává pole hledání nad tabulkou, když jsou data v prohlížeči. Na serveru o tom rozhoduje API.
- **`.format(value => text)`** text hodnoty, třeba měna. **`.render(row => …)`** celý obsah buňky. **`.align('end')`**, **`.width('12rem')`**, **`.class('…')`**.
- **`.aggregate('sum' | 'avg' | 'count' | 'min' | 'max')`:** součet v patičce, ze všech vyfiltrovaných řádků, ne jen ze stránky. Grid o něj žádá v dotazu (`aggregate`) a čeká ho v odpovědi (`aggregates: { price: { sum: 1500 } }`) jako Kendo. phlox-api-query součty zatím nepočítá, u dat v prohlížeči je spočítá grid.
- **`.alwaysVisible()`:** sloupec nejde skrýt.

## Stav v URL

**`grid.bind(this)`** v presenteru dá stránku, řazení, hledání a filtry do URL: `?page=2&sort=-price&q=fénix&f.category=Knihy,Sport&f.price=100..300`. Odkaz jde poslat a ukáže totéž, tlačítka Zpět a Vpřed vracejí předchozí stav, obnovení stránky ho drží. Parametry se stanou persistentními, takže odkaz na detail (routovaný dialog) je nese dál a po zavření dialogu je seznam stejný.

- **Grid musí patřit presenteru, který obsluhuje konec URL** (jeho routa nemá `presenter`). Jen ten dostává query parametry.
- **Dva gridy na stránce** potřebují předponu: `bind(this, 'items-')`.
- **Počet řádků na stránku** je v URL taky (`size`), výchozí hodnota se nepíše.
- **Bez `bind`** drží grid stav sám u sebe.

## Šířka, pořadí a viditelnost sloupců

S `remember: 'klíč'` si je grid pamatuje v prohlížeči (`localStorage`), patří k uživateli, ne do odkazu.

- **`resizable`:** šířka tažením za pravý okraj záhlaví. Po první změně dostanou šířku všechny sloupce a tabulka je široká jako jejich součet, takže sloupec roste přesně podle tahu a tabulka se případně posouvá do strany.
- **`reorderable`:** přesun tažením záhlaví, místo ukáže čára. Krátké kliknutí dál řadí.
- **`columnToggle`:** menu Sloupce se zaškrtávátky pro skrytí a s tlačítky ← → pro přesun z klávesnice.
- **Z kódu:** `grid.toggleColumn(key, show)`, `grid.moveColumn(key, before)`, `grid.shiftColumn(key, -1)`, `grid.setWidth(key, '200px')`, `grid.resetColumns()`.

## Akce

- **`addAction(label, { href | onClick, primary, danger, confirm, visible })`:** `primary` je tlačítko v řádku, ostatní jsou v menu ⋮. `href` dělá odkaz, `onClick` funkci, po které se grid načte znovu. `visible: row => …` ukáže akci jen u některých řádků.
- **`addBulkAction(label, (keys, rows) => …, { confirm, danger })`:** řádky dostanou zaškrtávátka, nad tabulkou se objeví lišta s počtem vybraných. Výběr platí napříč stránkami (podle klíčů), po akci se smaže a grid se načte znovu.
- **`confirm`** se ptá popoverem u tlačítka akce (`app.confirm` s `anchor`), u akce s `danger` s varovným OK. Jinou otázku nastaví `Grid.confirm = (question, anchor, danger) => …`, mimo běžící aplikaci se grid ptá přes `window.confirm`.

## Ostatní

- **`<GridView>`:** `search` (pole hledání), `resizable`, `reorderable`, `columnToggle`, `aria-label`, `class`.
- **Hledání a textové filtry** čekají 0,4 s po posledním stisku, Enter hned. Tlačítko Zrušit filtry smaže hledání i filtry.
- **Panely filtrů a menu** jsou umístěné `fixed`, takže je posuvná tabulka neořízne. Zavře je Escape (ne dialog kolem), klik mimo nebo odchod fokusu.
- **Během načítání** tabulka zesvětlí a má `aria-busy`, počet záznamů je v `role="status"`.
- **Texty** jsou výchozí anglicky, česky s `setTexts(cs)` (viz Překlady), jednotlivé v `Grid.texts`. **Vzhled** dodává téma, místa `grid.table`, `grid.th`, `grid.td`, `grid.pageLink`… (výchozí téma a Bootstrap podle PHP knihovny).
