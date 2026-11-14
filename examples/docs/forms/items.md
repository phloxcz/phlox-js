# Položky a data výběrů

Dropdownlist, combobox i taginput berou data dvěma způsoby:

| | `items` | `search` |
|---|---|---|
| **K čemu** | pevný seznam, filtruje se v prohlížeči | data ze serveru, filtruje server |
| **Dropdownlist, combobox: otevření bez psaní** | ukáže celý seznam | zavolá `search('')`, server vrátí první záznamy (třeba 100) |
| **Dropdownlist, combobox: při psaní** | filtruje hned | `search(text)` 250 ms po posledním stisku, starší odpověď se zahodí |
| **Taginput** | návrhy až při psaní | `search(text)` až při psaní, s prázdným textem se nevolá |

Volání s prázdným textem je záměrné, odpovídá `fetchData('')` v PHP knihovnách. Taginput ani v PHP nic nenabízí, dokud uživatel nepíše.

**`search` vrací stejný tvar jako `items`:** dvojice `[hodnota, popisek]`, nebo objekt `{ id: popisek }`. Když API vrací objekty, převedou se v té funkci. Třeba s metodou `stats.tasks` z `phlox-api-sample`:

```ts
form.addDropDownList('taskId', 'Úkol:', {
  search: async text => {
    const page = await this.api.call('stats.tasks', { query: { search: text, pageSize: 100 } });
    return page.data.map(task => [task.id!, task.name ?? ''] as const);
  },
  label: async id => (await this.api.call('task.read', { id })).name,   // pro uloženou hodnotu
});
```

- **Hledání bez ohledu na diakritiku** platí jen pro `items`. U `search` záleží na serveru. Pro vlastní filtrování v JS je `foldText()` z `@phloxcz/phlox-js/forms`.
- **`label` je potřeba jen u `search`,** pro hodnotu nastavenou z kódu, která mezi načtenými záznamy není. U `items` se popisek najde v seznamu.
- **Obojí najednou:** seznam bere `search`, `items` slouží jen k hledání popisků.

## Předvybraná hodnota ze vzdálených dat

Když `search` vrací jen prvních pár záznamů (třeba 100) a uložená hodnota mezi nimi není, platí pro dropdownlist i combobox:

- **Popisek se dá předat s hodnotou,** pokud ho data ze serveru už obsahují. Pak není potřeba žádný dotaz: `this.assignee.setValue(task.assignee.id, task.assignee.name)`, kde `this.assignee` je prvek vrácený z `addDropDownList()`.
- **Jinak ho zjistí `label`** podle ID, i po `setDefaults({ assignee: 5372 })`.
- **Po otevření seznamu je uložená hodnota první,** i když mezi prvními záznamy není. Uživatel tak vidí, co je vybrané. Jakmile začne psát, zobrazí se jen to, co hledání vrátí.

## Položky jako objekty a vlastní šablona

Dropdownlist, combobox i taginput berou položky i jako objekty, třeba uživatele rovnou ze serveru, a mohou je kreslit vlastní šablonou:

```tsx
form.addDropDownList('assigneeId', 'Řešitel', {
  items: users,                                  // UserResource[], nebo search, který objekty vrací
  itemValue: user => user.id,                    // hodnota prvku
  itemLabel: user => user.name,                  // text: hledání, čtečky, pole comboboxu
  template: user => <span><Avatar user={user} /> {user.name}</span>,
});
```

<!-- demo: items-objects -->

- **`itemValue` zapíná objekty** a je pak povinné. Kompilátor hlídá, že vrací typ pole z DTO, a `user` v ostatních funkcích má typ položek.
- **`itemLabel`** je text položky. Hledá se v něm (u `items` bez ohledu na diakritiku), čte ho čtečka a je v poli comboboxu. Bez něj je textem hodnota.
- **`template`** kreslí položku v seznamu, ve vybrané hodnotě dropdownlistu a ve štítcích taginputu. Combobox ji má jen v seznamu, v poli je text. Se šablonou se hledaný text nezvýrazňuje.
- **Hodnota z kódu** se nakreslí šablonou, když je její objekt mezi načtenými položkami. Jinak jde objekt předat s hodnotou (`setValue(5, user)`, u taginputu `setValue(ids, users)`), nebo ho vrátí volba `label` místo textu. Bez objektu se ukáže jen text.
- **Výčet hodnot se šablonou:** `items: ['open', 'closed'], itemValue: status => status, template: status => <StatusLabel status={status} />`.
- **Typ voleb** pro vlastní pomocné funkce: `DropDownListOptions<T, O>`, `ComboBoxOptions<T, O>`, `TagInputOptions<T, O>`. Jsou to sjednocení dvou tvarů (hodnoty, nebo objekty s `itemValue`), takže `Omit<…>` na ně nefunguje, použij průnik: `ComboBoxOptions<number> & { allowCustom?: false }`.
