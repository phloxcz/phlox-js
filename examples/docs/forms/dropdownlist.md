# DropDownList

Výběr s vyhledávacím polem, převzatý z [phloxcz/forms-dropdownlist](https://github.com/phloxcz/forms-dropdownlist). Má stejné HTML, třídy a ovládání, takže vypadá stejně jako jeho serverová verze v Nette.

```ts
// Pevné položky, hledá se v prohlížeči
form.addDropDownList('category', 'Kategorie:', { items: categories, placeholder: 'Vyberte' });

// Položky ze serveru
form.addDropDownList('assignee', 'Řešitel:', {
  search: text => this.api.call('user.search', { text }),   // vrátí [[id, jméno], ...]
  label: id => this.api.call('user.name', { id }),          // popisek uložené hodnoty
}).setRequired('Vyberte řešitele.');
```

<!-- demo: dropdownlist-basic -->

- **`items`** jsou pevné položky ve stejném tvaru jako u `addSelect`, filtrují se v prohlížeči.
- **`search`** se zavolá s `''` při otevření a pak s textem z vyhledávacího pole, 250 ms po posledním stisku. Starší odpověď nikdy nepřepíše novější.
- **`label`** zjistí popisek hodnoty nastavené z kódu (`setDefaults`), když hodnota není mezi položkami. V Nette ho dodává server při vykreslení.
- **Hledání nerozlišuje velikost písmen ani diakritiku:** „nap“ najde „Nápoje“ a zvýrazní „Náp“. Pro vlastní hledání na serveru je k dispozici `foldText()`.
- **Klávesnice:** šipka dolů seznam otevře, šipky vybírají, Enter a Tab potvrdí, Escape zavře jen seznam, ne dialog kolem něj. Klik mimo seznam ho zavře.
- **Kontrola** proběhne, až fokus opustí celý prvek, ne už při otevření seznamu.
- **Texty** jsou výchozí anglicky, česky s `setTexts(cs)` (viz Překlady), jednotlivé v `DropDownList.texts.noResults` a `filterPlaceholder`.
- **Panel se otevře pod tlačítkem, nebo nad ním,** když se dolů celý seznam nevejde a nahoře je víc místa. Když se nevejde nikam, seznam se zkrátí. Je umístěný `fixed`, takže ho dialog ani posuvný kontejner neořízne. Stranu ukazuje atribut `data-placement` (`bottom`, `top`).
- **Vzhled** dodává téma: místa `dropdownlist.wrapper`, `dropdownlist.trigger`, `dropdownlist.dropdown`, `dropdownlist.item`... CSS je v `base.css` a `default.css`.
