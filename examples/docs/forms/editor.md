# WYSIWYG editor

Editor ekosystému Phlox (phlox-editor, stejný jako v Nette formulářích) je součástí formulářů. Instaluje se s frameworkem. Editor i jeho CSS se stáhnou, až se ve stránce poprvé ukáže, takže aplikace bez editoru je nestahuje.

```ts
this.form.addEditor('text', 'Komentář', {
  toolbar: 'format,lists,link,image',     // skupiny tlačítek, řádky odděluje |
  minHeight: 44,
  placeholder: 'Napsat komentář…',
  upload: file => this.uploadImage(file), // vrátí adresu obrázku
  inlineImages: false,                    // obrázek, který nejde nahrát, se nevloží jako base64
}).setRequired('Napište text komentáře.');
```

<!-- demo: editor-basic -->

- **Hodnota** je HTML. V každém prohlížeči vyjde stejně: `<strong>`, `<em>`, `<s>`, barvy jako styly, bez prázdných `span`. Prázdný editor dá `''`, takže `setRequired()` funguje. Prázdné HTML odjinud (`<p>&nbsp;</p>`) se také počítá jako nevyplněné. Zobrazí se přes `<Html>` (viz HTML od uživatelů).
- **Chová se jako ostatní prvky:** chyby u pole i ze serveru, `setDefaults()`, `reset()`, `isChanged()`, `setDisabled()`, `setReadOnly()` (skryje lištu). Kontrola proběhne po opuštění celého editoru, ne už při přechodu do jeho lišty.
- **Vzhled podle tématu:** s `BootstrapTheme` editor dostane podobu pro Bootstrap, jinak výchozí. Volba `theme` to přepíše.
- **Skupiny lišty:** `styles`, `format`, `script`, `fontsize`, `color`, `bgcolor`, `align`, `case`, `blocks`, `lists`, `link`, `image`, `table`, `emoji`, `specialchar`, `hr`, `clearfmt`, `grid`, `source`, `fullscreen`, a s volbami `variables` a `widgets` i stejnojmenné skupiny. Bez `toolbar` jsou v liště všechny.
- **Volby pro celou aplikaci:** `Editor.defaults = { colorScheme: 'auto' }` (z `@phloxcz/phlox-js/forms`). Vlastní volby editoru jdou přes ně.
- **`control.editor`** je běžící editor, například pro `insertText('👍')` z vlastní nabídky emoji. Text se vloží tam, kde byl kurzor. Dokud se editor nenačte, je `null`.
- **`control.element`** je editovatelná plocha. Dostane `id` prvku a `role="textbox"`. Dokud se editor nenačte, je `null`.
- **`control.focus()`** dá fokus do editoru, i když ještě není načtený: pak hned, jak vznikne. Proto ho používej místo `control.element?.focus()`.
- **Klávesy:** Enter dělá nový odstavec. Odeslání třeba na Ctrl+Enter si nastavte obsluhou `onKeydown` na prvku kolem.
- **Obrázky:** vložené ze schránky nebo vybrané v okně „Vložit obrázek“ jdou do `upload(file)`. Dokud se nahrávají, je na jejich místě „Nahrávám…“, které do hodnoty nepatří. Bez `upload` se obrázek pošle na `uploadUrl`, a není-li ani ta, vloží se jako base64. Selže-li nahrání a `inlineImages` je `false`, obrázek se nevloží. Uživateli to oznamte v `upload` (helpdesk ukáže flash zprávu).
- **Vložené HTML** z Wordu, Google Docs a webů se vyčistí: zahodí se písma, okraje, třídy `Mso…`, skripty, komentáře a obsluhy událostí.
- **Úpravy vzhledu:** CSS editoru se načte až s ním, tedy za CSS aplikace. Vlastní pravidla proto potřebují silnější selektor než ta jeho (`.moje-pole .phx-editor-toolbar .phx-editor-toolbar-row`). Barvy jde měnit proměnnými `--phx-editor-*` na `.phx-editor-wrapper`. Kdo chce CSS hned, naimportuje ho sám: `import '@phloxcz/forms-editor/wysiwyg.css'`.

## Plovoucí lišta

V úzkém místě (sloupec, karta) by se pevná lišta zalomila do mnoha řádků a zabrala víc místa než text. S volbou `floatingToolbar` je lišta vidět, jen když má editor fokus. Ukáže se nad ním, přes to, co je nad ním, a nezabírá místo:

```ts
this.form.addEditor('perex', 'Perex', { floatingToolbar: true, minHeight: 90 });
```

<!-- demo: editor-floating -->

- **Šířka podle tlačítek, ne podle editoru,** nejvýš 44rem a šířka okna. V úzkém editoru tak stačí jeden nebo dva řádky.
- **Drží se v okně:** u pravého okraje se posune doleva. Když nad editorem není místo, ukáže se pod ním.
- **Fokus** může být i na tlačítku nebo výběru lišty, lišta při klikání nezmizí. Po opuštění editoru zmizí.
- **Na celou obrazovku** je lišta pevná jako jindy.

Bez formuláře, HTML vázané na stav oběma směry:

```tsx
import { Editor } from '@phloxcz/phlox-js/forms';

<Editor value={this.text} options={{ toolbar: 'format,lists', minHeight: 120 }} label="Poznámka" />
```

Editor vznikne, když je prvek ve stránce, a zruší se s částí šablony. Změna stavu zvenku přepíše obsah editoru. `onCreate(editor, pane)` dá běžící editor.

**V testech** v jsdom editor funguje taky. Načítá se asynchronně, takže na něj počkejte (`await until(() => element.querySelector('[contenteditable]'))`). jsdom nemá `execCommand`, proto tlačítka lišty nic nedělají. Psaní uživatele se napodobí změnou plochy a událostí `input`, viz `tests/editor.test.tsx`.
