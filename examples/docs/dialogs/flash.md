# Flash zprávy

```ts
this.flashMessage('Uloženo.', 'success');                           // v komponentě i presenteru
this.flashMessage('Hotovo.', 'info', { duration: 2000 });           // vlastní doba
this.flashMessage('Objednávka odeslána.', 'success', { title: 'Hotovo' });
```

Aplikace zprávy ukazuje jako toasty převzaté z [capify](https://github.com/phloxcz/capify): skládají se v rohu, mají proužek se zbývajícím časem, při najetí myší nebo fokusu čekají a mají křížek. Vzhled dává téma (výchozí, Bootstrap jako `alert`), takže sleduje tmavý režim i přepínač animací.

<!-- demo: flash-types -->

- **Typy:** `info`, `success`, `warning`, `error`. Chyba se čtečkám ohlásí hned (`role="alert"`), ostatní zdvořile (`role="status"`).
- **Zprávy samy mizí** po 5 sekundách. Chyby zůstávají, dokud je uživatel nezavře, aby je nepřehlédl. Pro celou aplikaci se to nastaví na službě: `app.flashes.duration = 3000`, `app.flashes.errorDuration = 10000` (0 = nezmizí sama).
- **Roh** se nastaví před startem aplikace: `top-right` (výchozí), `top-left`, `top-center`, `bottom-left`, `bottom-center`, `bottom-right`. Třeba vlastní službou: `const flashes = new FlashMessages(); flashes.position = 'bottom-right'; services.add(flashes);`.
- **Rozdíl proti Nette:** tam zpráva přežije přesměrování a ukáže se na další stránce. V SPA se stránka nepřenačítá, takže zprávy fungují jako toasty.
- **Vzhled:** místa `toast.card`, `toast.info`, `toast.success`, `toast.warning`, `toast.error`, `toast.title`, `toast.message`, `toast.close`. **Text** křížku pro čtečky: `messageTexts.close`.

## Zobrazení v layoutu

Kdo chce zprávy vykreslit sám, vypne toasty (`toasts = false`) a zprávy najde v `app.flashes.messages`:

```ts
const flashes = new FlashMessages();
flashes.toasts = false;
services.add(flashes);
```

```tsx
<For each={this.app.flashes.messages}>
  {flash => (
    <p class={`flash ${flash.type}`} role="status">
      {flash.text}
      <button type="button" aria-label="Zavřít" onClick={() => this.app.flashes.remove(flash)}>×</button>
    </p>
  )}
</For>
```

## Zobrazení přes capify

Adaptér pro aplikace, které chtějí přímo knihovnu capify, třeba kvůli stránkám společným s Nette:

```ts
import * as Capify from '@phloxcz/capify';
import '@phloxcz/capify/capify.css';
import { CapifyFlashMessages } from '@phloxcz/phlox-js/adapters/capify';

services.add(new CapifyFlashMessages(Capify, { position: 'top-right', theme: 'bootstrap' }));
```

Druhý parametr jsou volby `Capify.notify()` pro všechny zprávy. Toasty frameworku se pak neukazují. `@phloxcz/phlox-js` capify nevyžaduje, instaluje ho aplikace.
