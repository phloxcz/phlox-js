# Prvky

| Metoda | Hodnota |
|---|---|
| `addText(name, label, maxLength?)` | text, `''` když je prázdný. S `setNullable()` je prázdný `null` |
| `addPassword`, `addEmail`, `addTextArea` | text. `addEmail` rovnou kontroluje formát |
| `addInteger`, `addFloat` | číslo nebo `null`. `addFloat` bere i desetinnou čárku |
| `addDate` | text `RRRR-MM-DD` nebo `null`, tak jak datum čeká DTO |
| `addCheckbox(name, caption)` | `true` / `false` |
| `addSelect`, `addRadioList` | jedna z hodnot položek nebo `null` |
| `addMultiSelect`, `addCheckboxList` | pole hodnot položek |
| `addDropDownList(name, label, options)` | jedna z hodnot položek nebo `null`, výběr s hledáním (viz DropDownList) |
| `addComboBox(name, label, options)` | jedna z hodnot položek nebo `null`, textové pole s návrhy (viz ComboBox) |
| `addTagInput(name, label, options)` | pole hodnot, štítky (viz TagInput) |
| `addUpload(name, label)` | `File` nebo `null` (viz Soubory) |
| `addMultiUpload(name, label)` | `File[]` (viz Soubory) |
| `addEditor(name, label, options)` | HTML z editoru WYSIWYG, `''` když je prázdný (viz WYSIWYG editor) |
| `addTreeSelect(name, label, options)` | id uzlu stromu nebo `null` (viz Výběr ze stromu) |
| `addTreeMultiSelect(name, label, options)` | pole id uzlů stromu |
| `addDropDownTreeSelect(name, label, options)` | id uzlu stromu nebo `null`, strom v rozbalovacím panelu |
| `addHidden(name, value)` | text |
| `addSubmit(name, caption)` | tlačítko, mezi hodnotami není |
| `addContainer(name, label)` | vnořený objekt, viz Kontejnery a řádky |
| `addMultiplier(name, factory, options)` | seznam objektů, řádky, které uživatel přidává a řadí |

<!-- demo: controls-all -->

**Položky** výběrů se zadávají jako dvojice `[[1, 'Nízká'], [2, 'Vysoká']]`, jako objekt `{ 1: 'Nízká' }`, ve kterém se celočíselné klíče převedou na čísla jako v PHP, nebo jako seznam hodnot, které jsou zároveň popisky: `['Albert', 'Billa']`. Přijít mohou i později, třeba ze serveru: `control.setItems(...)`.

Další metody prvku: `setDisabled()` (nekontroluje se a chybí v hodnotách), `setOmitted()`, `getValue()`, `setValue()`, `errors()`, `addError()`, `focus()` (fokus do prvku, třeba z tlačítka „Napsat komentář“; po neúspěšné kontrole ho formulář volá sám).
