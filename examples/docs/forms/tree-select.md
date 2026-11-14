# Výběr ze stromu

Strom přímo ve formuláři, u každého uzlu přepínač nebo zaškrtávátko, jako picker z [phloxcz/components-tree](https://github.com/phloxcz/components-tree). Uzly se zadávají stejně jako u stromu (viz Strom):

```ts
// Jeden uzel: id nebo null
form.addTreeSelect('parentId', 'Nadřazená kategorie:', {
  load: parent => this.api.call('category.children', { parentId: parent?.id ?? null }),
  path: id => this.api.call('category.path', { id }),
  lines: true,
}).setRequired('Vyberte kategorii.');

// Několik uzlů: pole id
form.addTreeMultiSelect('pageIds', 'Stránky:', { nodes: pages });
```

<!-- demo: tree-select -->

- **Hodnota** je id uzlu (typ podle DTO, třeba `number | null`), u více uzlů pole id. Uzly jsou na sobě nezávislé: zaškrtnutí rodiče neznamená zaškrtnutí dětí.
- **Vybírá se** klikem kamkoli na řádek, nebo mezerníkem či Enterem na uzlu. Šipky procházejí strom jako u stromu.
- **Vybraný uzel hluboko v líném stromu** se ukáže, když má strom `path`: po `setDefaults({ parentId: 121 })` se načte a rozbalí cesta k němu.
- **Kontrola** proběhne po opuštění stromu, po první chybě živě. Fokus po chybě dostane vybraný nebo první uzel.
- **Strom prvku** je `control.tree`, třeba pro `control.tree.reload()` po změně na serveru.
- **Vzhled:** obal má třídu `phlox-treeselect` a místo tématu `treeselect`. Delší strom omez výškou: `.phlox-treeselect { max-height: 16rem; overflow: auto; }`.

## Rozbalovací výběr ze stromu

Jeden uzel stromu v rozbalovacím panelu, vypadá a ovládá se jako dropdownlist. Zavřený ukazuje cestu od kořene k vybranému uzlu, otevřený strom:

```ts
form.addDropDownTreeSelect('parentId', 'Nadřazená kategorie:', {
  load: parent => this.api.call('category.children', { parentId: parent?.id ?? null }),
  path: id => this.api.call('category.path', { id }),
  placeholder: 'Žádná, horní úroveň',
});
// zavřený: „Domácnost › Kuchyně › Nože“
```

- **Hodnota** je id uzlu nebo `null`. Uzly se zadávají stejně jako u stromu (`nodes`, nebo `load` s `path`).
- **Cesta v tlačítku** se skládá z popisků uzlů. Hodnota nastavená z kódu hluboko v líném stromu si cestu načte přes `path`, mezitím je v tlačítku `…`. Bez `path` umí líný strom ukázat jen načtené uzly, jinak ukáže id. Celá cesta je i v `title`, kdyby se do tlačítka nevešla. Oddělovač mění volba `separator` (výchozí ` › `).
- **Otevření:** klik, šipka dolů, Enter nebo mezerník. Strom ukáže cestu k vybranému uzlu a dá na něj fokus. Panel se otevře pod tlačítkem, nebo nad ním, když dole není místo.
- **Výběr:** klik na uzel, nebo Enter či mezerník. Panel se zavře a fokus se vrátí na tlačítko. Escape zavře jen panel, ne dialog kolem.
- **Vymazání:** u nepovinného prvku křížek v tlačítku, nebo Delete či Backspace na tlačítku.
- **`lines`** zapne čáry stromu v panelu. **Strom prvku** je `control.tree`, třeba pro `control.tree.reload()`.
- **Vzhled** je dropdownlistu (místa `dropdownlist.wrapper`, `dropdownlist.trigger`, `dropdownlist.dropdown`), obal má navíc třídu `phlox-dropdowntree` a panel `phlox-dropdowntree-panel`. **Texty:** `DropDownTreeSelect.texts.clear`.
