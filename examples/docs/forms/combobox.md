# ComboBox

Textové pole s návrhy, převzaté z [phloxcz/forms-combobox](https://github.com/phloxcz/forms-combobox). Na rozdíl od dropdownlistu se píše přímo do pole.

```ts
form.addComboBox('country', 'Země:', { search: text => this.api.call('country.search', { text }) });

// Napsaný text, který není mezi návrhy, se stane hodnotou
form.addComboBox('shop', 'Obchod:', { items: shops, allowCustom: true });
```

<!-- demo: combobox-basic -->

- **Hodnota je vybraná položka.** Dokud uživatel jen píše, hodnota je `null`. Napsaný text, který není položkou, se po opuštění pole zahodí a vrátí se předchozí hodnota. Napsaný přesný název položky (bez ohledu na velikost písmen a diakritiku) se vybere sám.
- **`allowCustom: true`:** napsaný text se stane hodnotou a `isCustom()` vrací `true`. Kompilátor ho dovolí jen u pole, které může obsahovat text.
- **Klávesnice:** šipky vybírají, Enter vybere zvýrazněnou položku. Bez zvýraznění Enter odešle formulář jako v každém textovém poli. Escape v otevřeném seznamu vrátí předchozí hodnotu, v zavřeném ho dostane dialog kolem.
- **`items`, `search`, `label` a `placeholder`** fungují stejně jako u dropdownlistu, stejně se panel otáčí nahoru a hledá bez ohledu na diakritiku.
- **Texty:** `ComboBox.texts.noResults`. **Vzhled:** místa `combobox.wrapper`, `combobox.input`, `combobox.dropdown`, `combobox.item`...
