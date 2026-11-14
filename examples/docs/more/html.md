# HTML od uživatelů

Text se do šablony píše jako `{text}` a prohlížeč ho ukáže jako text, nic se nespustí. HTML, které napsal uživatel (komentář z editoru, obsah CMS), ukáže `<Html>`. Je to obdoba `|noescape` v Latte, ale HTML se před zobrazením vyčistí:

```tsx
import { Html } from '@phloxcz/phlox-js';

<Html html={() => comment().text} class="comment-text" />        // <div class="comment-text">…</div>
<Html html={note} tag="span" />                                  // jiný obal: span, section, article
```

<!-- demo: html-sanitize -->

- **Co zůstane:** odstavce, nadpisy, tučné, kurzíva, podtržení, přeškrtnutí, seznamy, citace, kód, tabulky, odkazy a obrázky.
- **Co se zahodí:** skripty, styly, `iframe`, formuláře, `svg` a komentáře, všechno i s obsahem. Neznámé značky se nahradí svým obsahem. Zahodí se i atributy `on…`, odkazy `javascript:` a obrázky `data:` jiné než PNG, JPEG, GIF a WebP.
- **Styly** zůstanou jen ty, které mění vzhled textu (barva, pozadí, zarovnání, tučnost, šířka a výška). `position`, `url()` a podobné zmizí, takže obsah nepřekryje stránku.
- **Třídy** se zahazují, protože třídy stránky by obsah mohly přestylovat. `options={{ classes: true }}` je ponechá.
- **Další značky:** `options={{ tags: { abbr: [], iframe: ['src', 'width', 'height'] } }}` (značka a její povolené atributy).
- **Odkaz do nového okna** dostane `rel="noopener noreferrer"`.

`sanitizeHtml(html, options)` je samotné čištění, `<Html>` ho volá při každé změně. **Na serveru** HTML čistěte taky, `<Html>` chrání jen zobrazení ve frameworku. V Node stačí dokument z jsdom, čištění pak proběhne stejně jako v prohlížeči. Tak to dělá mock server helpdesku:

```ts
import { JSDOM } from 'jsdom';
import { sanitizeHtml } from '@phloxcz/phlox-js';

const document = new JSDOM('').window.document;
const clean = (html: string) => sanitizeHtml(html, { document });
```
