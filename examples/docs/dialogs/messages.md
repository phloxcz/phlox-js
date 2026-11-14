# Alert, confirm, prompt

Náhrada `window.alert()`, `confirm()` a `prompt()` převzatá z capify. V komponentě a presenteru jako metody, jinde přes `app`:

```ts
await this.alert('Uloženo.');
if (await this.confirm('Smazat položku?', { danger: true, okText: 'Smazat' })) { … }
const name = await this.prompt('Nový název:', { value: item.name });   // text, nebo null

// Malý popover u tlačítka místo dialogu
<button onClick={async event => {
  if (await this.confirm('Smazat?', { anchor: event.currentTarget, danger: true })) await this.handleDelete();
}}>Smazat</button>

// Dialog bez tlačítek, než něco doběhne
const loading = this.showLoading('Ukládám…');
loading.update('Ukládám 2 z 5…');
loading.close();
```

<!-- demo: messages-all -->

- **Dialog** je okno frameworku (nativní `<dialog>`), vypadá jako ostatní dialogy aplikace. `confirm` vrátí `true` pro OK, `false` pro Zrušit, Escape i křížek. `prompt` vrátí text, nebo `null`. Enter v poli potvrdí.
- **Popover** (`anchor: prvek`) se ukáže u prvku, pod ním vlevo, nebo podle `placement` (`bottom-left`, `bottom-right`, `top-left`, `top-right`). Když se nevejde, otočí se. Fokus dostane OK (u `danger` Zrušit) nebo pole, Escape a klik mimo ho zruší, potom se fokus vrátí na prvek. Escape nezavře dialog pod ním.
- **Volby:** `title`, `okText`, `cancelText`, `danger` (OK varuje, třeba u mazání, a fokus dostane Zrušit, aby Enter nic nezničil), u `prompt` `value` a `placeholder`.
- **`showLoading`** uživatel nezavře, ani Escapem; zavře ho `close()`. Zpráva může být šablona, ne jen text.
- **Zpráva** je text nebo šablona, nikdy HTML v textu, takže nehrozí vložení cizího kódu.
- **Texty tlačítek:** `messageTexts.ok`, `cancel`, `close`, `loading` z `@phloxcz/phlox-js` (`unsaved` a `leave` patří k odchodu s neuloženými změnami). **Vzhled:** místa `message.*` (dialog) a `popover.*` (popover; v Bootstrapu jeho `popover` se šipkou).
- **Grid** se před akcí s `confirm` ptá popoverem u tlačítka akce.
