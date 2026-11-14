# Kontejnery a řádky

DTO s vnořeným objektem a se seznamem objektů, třeba faktura s odběratelem a řádky:

```tsx
interface Line { name: string; quantity: number | null; price: number | null }
interface Invoice { number: string; customer: { name: string; city: string }; lines: Line[] }

form = new Form<Invoice>();
lines: Multiplier<Line>;

constructor() {
  super();
  this.form.addText('number', 'Číslo:');

  // Vnořený objekt, jako $form->addContainer() v Nette
  const customer = this.form.addContainer('customer', 'Odběratel');
  customer.addText('name', 'Název:').setRequired();
  customer.addText('city', 'Město:');

  // Řádky, které uživatel přidává, odebírá a řadí. Funkce přidá prvky jednoho řádku.
  this.lines = this.form.addMultiplier('lines', line => {
    line.addText('name', 'Položka').setRequired();
    line.addInteger('quantity', 'Množství').addRule(Form.Min, 'Aspoň %d.', 1);
    line.addFloat('price', 'Cena');
  }, { min: 1, max: 50, label: 'Řádky' });
}

// Součet sleduje psaní v každém řádku i přidání, odebrání a přesun
total = computed(() => this.lines.getValues().reduce((sum, line) => sum + (line.quantity ?? 0) * (line.price ?? 0), 0));
```

<!-- demo: containers-invoice -->

- **Typy:** kontejner nabízí jen prvky vnořeného objektu, řádek jen prvky položky seznamu. `addContainer` jde jen na objekt, `addMultiplier` jen na seznam objektů. Seznam textů nebo čísel je `addTagInput` nebo `addCheckboxList`.
- **Hodnoty** mají tvar DTO: `{ number, customer: { name, city }, lines: [{ name, quantity, price }, ...] }`, řádky v pořadí, v jakém je uživatel seřadil. `setDefaults` bere i neúplné vnořené objekty a řádky. Řádků vznikne tolik, kolik jich přijde, nejméně `min`.
- **Přístup:** `form.getContainer('customer').get('city')`, `form.getMultiplier('lines')`, `lines.rows()` (řádky jako kontejnery, reaktivně), `row.get('name')`.
- **Řádky z kódu:** `lines.add({ name: 'Doprava' })` (vrátí `null`, když je jich už `max`), `lines.add(values, 0)` na začátek, `lines.remove(row)` (ne pod `min`), `lines.move(row, 2)`, `lines.canAdd()`, `lines.canRemove()`.
- **`min` a `max`:** tlačítka je hlídají, a když se počet nesejde (třeba po `setValues`), ukáže se nad řádky chyba `Multiplier.texts.min` nebo `max`. Bez `max` není horní hranice.
- **Kontrola** prochází všechny kontejnery i řádky, kurzor skočí na první chybu.
- **Atributy `name`** jsou jako v Nette: `customer[city]`, `lines[3][quantity]`. Číslo v `name` a `id` řádku se při přesunu nemění, takže id zůstávají jedinečná. Pořadí dává jen pořadí řádků.

**Vykreslení:** `<FormView>` ukáže kontejner jako `<fieldset>` s legendou a řádky s ovládáním:

- **úchyt ⠿** pro přetažení myší, perem i prstem; na úchytu posouvají řádek i šipky nahoru a dolů z klávesnice,
- **tlačítka ↑ ↓ ×** pro posun a odebrání,
- **„+ Add“** přidá řádek a kurzor dá do jeho prvního pole.

Ručně, třeba jako tabulku bez popisků v každém řádku:

```tsx
<FormTag form={this.form}>
  <MultiplierView multiplier={this.lines}>
    {(line, index) => (
      <>
        <span>{() => index() + 1}.</span>
        <Input control={line.get('name')} /> <InputError control={line.get('name')} />
        <Input control={line.get('quantity')} />
      </>
    )}
  </MultiplierView>
  <p>Celkem: {() => this.total()}</p>
</FormTag>
```

- **`<MultiplierView>`** dává úchyt, tlačítka a přidání. Funkce v něm vykreslí prvky řádku, `index()` je jeho reaktivní pořadí.
- **`<MultiplierErrors multiplier={…} />`** ukáže chyby počtu řádků, když `<MultiplierView>` nepoužiješ.
- **Řádky jsou `<For>` bez `key`:** při přesunu se prvek přesune s celým obsahem, rozepsaný text ani fokus se neztratí.
- **Texty** jsou výchozí anglicky, česky s `setTexts(cs)` (viz Překlady), jednotlivé v `Multiplier.texts` (`add`, `remove`, `moveUp`, `moveDown`, `drag`, `min`, `max`).
- **Vzhled** dodává téma: místa `group`, `legend`, `multiplier`, `multiplierRow`, `multiplierHandle`, `multiplierFields`, `multiplierField`, `multiplierButtons`, `multiplierButton`, `multiplierAdd`. Tažený řádek má třídu `phlox-dragging`.

## Řazení tažením jinde

Tažení řádků stojí na funkci `dragToSort` z `phlox-js`, kterou jde použít pro jakýkoli seznam:

```tsx
render() {
  let list: HTMLElement;
  return (
    <ul ref={el => { list = el; }}>
      <For each={this.cards}>
        {card => {
          let element: HTMLElement;
          return (
            <li ref={el => { element = el; }}>
              <span class="handle" onPointerdown={event => dragToSort(event, element, {
                items: () => [...list.children] as HTMLElement[],
                move: to => this.cards.update(cards => {
                  const rest = cards.filter(other => other !== card);
                  rest.splice(to, 0, card);
                  return rest;
                }),
                done: () => this.handleSaveOrder(),
              })}>⠿</span>
              {card.name}
            </li>
          );
        }}
      </For>
    </ul>
  );
}
```

<!-- demo: drag-sort -->

- **`items`** vrací prvky všech položek v aktuálním pořadí, i taženou.
- **`move(to)`** přesune taženou položku v datech. `<For>` pak přesune prvek, takže uživatel vidí nové pořadí hned během tažení.
- **`done`** se zavolá po puštění, třeba pro uložení pořadí na serveru.
- **Tažená položka jede volně za ukazatelem** (posun přes `transform`), ostatní jí plynule uhýbají a po puštění položka dosedne na místo. Během tažení má třídu `phlox-dragging`.
- **`layout`** říká, jak položky leží, a podle toho se volí pořadí: `'vertical'` (výchozí, pod sebou, podle svislé polohy), `'horizontal'` (vedle sebe, podle vodorovné) a `'grid'` (v řádcích, které se zalamují, v pořadí čtení: řádek po řádku, zleva doprava). Položky mřížky by měly mít stejnou výšku.
- **`lockAxis: true`** nechá položku jezdit jen po ose seznamu, u `'vertical'` jen nahoru a dolů. U mřížky nemá smysl.
- **Pozice** se volí podle středu tažené položky proti středům ostatních.
- **Úchyt může být celá položka:** `onPointerdown` dej přímo na ni.
- **Escape** tažení ukončí. Položka zůstane tam, kam už dojela, protože se v datech přesouvá průběžně.
- **U okraje se posouvá:** když ukazatel dojede k okraji, posouvá se nejbližší posuvný prvek kolem seznamu (třeba dialog nebo box s `overflow: auto`), jinak stránka. Čím blíž okraji, tím rychleji. Funguje svisle i vodorovně a zastaví se na konci obsahu.
- **Úchyt potřebuje CSS `touch-action: none`,** jinak prstem posouvá stránku.
