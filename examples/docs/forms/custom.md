# Vlastní prvek

Prvek je potomek `FormControl<T>` s metodami `getValue()`, `setValue()`, `isFilled()` a `render(attributes)`. Do formuláře se přidá přes `form.addControl('name', new MyControl('Popisek:'))`. Pravidla, `<Label>`, `<Input>`, chyby ze serveru i hodnoty pak fungují jako u vestavěných prvků. Tak vzniknou i combobox, dropdownlist a taginput.

<!-- demo: custom-rating -->
