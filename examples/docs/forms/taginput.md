# TagInput

Více hodnot jako štítky, převzaté z [phloxcz/forms-taginput](https://github.com/phloxcz/forms-taginput). Pole v DTO musí být seznam.

```ts
// Kategorie podle ID, jen z návrhů
form.addTagInput('categories', 'Kategorie:', { search: text => this.api.call('category.search', { text }) });

// Textové štítky, nové vznikají z napsaného textu
form.addTagInput('labels', 'Štítky:', { items: labels, allowNew: true, maxTags: 5 });
```

<!-- demo: taginput-basic -->

- **Návrhy se ukážou při psaní,** bez štítků, které už jsou přidané. S `allowNew` je posledním návrhem „Vytvořit: "text"“.
- **Přidání štítku:** Enter nebo čárka vezme zvýrazněný nebo první návrh. Když se návrhy neukazují, vezme napsaný text: přesný název položky, nebo s `allowNew` nový štítek. Enter v tomto poli nikdy neodešle formulář, jako v PHP verzi.
- **Odebrání:** křížek u štítku, nebo Backspace v prázdném poli odebere poslední.
- **Duplicity** se nepřidají, u textu bez ohledu na velikost písmen a diakritiku.
- **`maxTags`** omezí počet štítků. Pro chybovou hlášku použij pravidla `Form.MinLength` a `Form.MaxLength`, které u seznamu počítají štítky.
- **Napsaný text, který nebyl potvrzený,** se na štítek převede až při odeslání formuláře, ne při opuštění pole.
- **`getSplitValue()`** vrátí `{ picked, created }`: hodnoty vybrané z návrhů a texty nových štítků zvlášť, jako `getSplitValue()` v PHP.
- **`allowNew`** kompilátor dovolí jen u seznamu, který může obsahovat text. Výchozí je vypnuté (v PHP zapnuté).
- **Hodnoty z kódu:** `setValue([1, 2])`, popisky z položek nebo z `label`. Popisky ze serveru jdou předat rovnou: `setValue(ids, names)`.
- **Texty:** `TagInput.texts.createNew`, `TagInput.texts.remove`. **Vzhled:** místa `taginput.container`, `taginput.tag`, `taginput.tagNew`, `taginput.option`...
