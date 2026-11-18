# Dialog s URL

Deklaruje se u routy. Na `/users/15` zůstane vidět seznam a nad ním se otevře dialog. Dá se na něj odkázat a tlačítko Zpět ho zavře.

```ts
public override routes: Route[] = [
  { name: 'default', pattern: '/' },
  {
    name: 'edit',
    pattern: '/<id \\d+>',
    dialog: ({ id }) => [UserEdit, { userId: Number(id) }],
    closed: saved => {
      if (saved) void this.reload();
    },
  },
];
```

```tsx
<a href={this.link('edit', { id: user.id })}>Upravit</a>
```

- **`closed`** dostane to, co dialog předal do `close()`. Když ho zavřela navigace (tlačítko Zpět, jiný odkaz), dostane `undefined`.
- **Zavření vrátí URL zpět:** uvnitř aplikace krokem zpět v historii, po příchodu přímým odkazem nahrazením URL.
- **Seznam pod dialogem načítej ve `startup()`.** Po přímém odkazu na dialog se `actionDefault()` nespustí.
- **Když `startup()` dialogu selže,** selže celá navigace. Odkaz na smazaný záznam proto ošetři v akci presenteru (`actionEdit`) nebo v dialogu.
- **`closed` se zavolá vždy,** i když dialog zmizí proto, že se zavřel dialog pod ním nebo se odešlo z presenteru.

## Dialog z dialogu

Dialog, který je `Presenter`, má vlastní routy, a ty mohou otevřít další dialog. Každá úroveň přidá kus URL. V ukázce je to úprava položky (`/5`) → historie změn (`/5/history`) → detail změny (`/5/history/1`):

```ts
// Seznam: /5 otevře úpravu
{ name: 'edit', pattern: '/<id \\d+>', dialog: ({ id }) => [ItemEdit, { id: Number(id) }] }

// ItemEdit extends Presenter<{ id: number }, boolean>: /5/history otevře historii nad ní
public override routes: Route[] = [
  { name: 'default', pattern: '/' },
  { name: 'history', pattern: '/history', dialog: () => [ItemHistory, { id: this.props.id }], closed: () => void this.loadName() },
];

// ItemHistory extends Presenter<{ id: number }>: /5/history/1 otevře detail změny
public override routes: Route[] = [
  { name: 'default', pattern: '/' },
  { name: 'change', pattern: '/<index \\d+>', dialog: ({ index }) => [ChangeDetail, { id: this.props.id, index: Number(index) }] },
];
```

```tsx
<a href={this.link('history')}>Historie</a>        // uvnitř ItemEdit vede na /5/history
```

- **Odkazy uvnitř dialogu** míří na routy jeho presenteru, `this.link('history')` tedy doplní `/history` za `/5`.
- **Zavření nejvyššího dialogu** vrátí URL o úroveň níž a jeho výsledek dostane `closed` routy o úroveň níž. Tlačítko Zpět zavírá dialogy jeden po druhém.
- **Přímý odkaz** `/5/history/1` otevře všechny tři naráz. Zavírání pak nahrazuje URL úroveň po úrovni.
- **Přechod na nižší úroveň** zavře dialogy nad ní. Odchod jinam zavře všechny, každý `closed` dostane `undefined`.
- **Data pod dialogem znovu načti v `closed`,** i bez výsledku. Uživatel mohl změnu udělat ve vyšším dialogu a pak se vrátit tlačítkem Zpět.
- **Nativní `<dialog>` je modální,** ovládat jde jen ten nahoře. Dialogy pod ním jsou neaktivní, dokud se horní nezavře.

<!-- demo: routed-dialogs -->

## Vzhled a výměna okna

Výchozí okno je nativní `<dialog>` s částmi `header`, tělem a `footer`. Třídy mu dává téma (viz Vzhled a témata), u výchozího tématu `phlox-dialog`, `phlox-dialog-header` a další. V Bootstrapu vypadá jako jeho modal, se stínem `shadow-lg`.

- **Animace** jsou v `base.css`, takže je má každé téma: okno při otevření sjede shora, panel se objeví a posune se o posledních 50 px ze své strany (nelétá přes celou šířku), pozadí se ztmaví a při zavření vše odejde zpět. Řídí je `setMotion()` (viz Animace), s `off` je vše okamžité.
- **Klik vedle okna** (na ztmavené pozadí) je jako Escape: volá `cancel()`, takže se případně zeptá na neuložené změny. Výběr textu, který skončí mimo okno, okno nezavře.
- **Fokus** po otevření dostane první pole v těle, bez pole celé okno (ne křížek). Prvek s `autofocus` má přednost.
- **Rozbalovací panely** (`Dropdown`, popover u `confirm`) uvnitř dialogu zůstávají v něm, takže nejsou pod jeho pozadím.

Okno dodává služba `Dialogs`. Jinou implementaci, třeba nad Kendo Window, zaregistruješ v kontejneru: `services.add(KendoDialogs)`. Její `show(component, options)` dostane i `DialogOptions` (`placement`, `class`). Zavření okna uživatelem (Escape, ×, klik vedle) musí volat `component.cancel()`, aby se mohl zeptat na neuložené změny.
