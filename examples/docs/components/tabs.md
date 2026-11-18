# Záložky

Řada záložek nad panely, vidět je jen panel zvolené záložky. Hodí se pro dlouhé formuláře, třeba produkt nebo uživatele.

```tsx
import { Tab, Tabs } from '@phloxcz/phlox-js';

<Tabs aria-label="Produkt">
  <Tab title="Název a popis">…</Tab>
  <Tab title={<><i class="bi bi-tag" /> Varianty</>}>…</Tab>
  <Tab title={<><img src="/flags/cz.svg" alt="" /> Česky</>}>…</Tab>
  <Tab title={<><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">…</svg> Systémové</>}>…</Tab>
</Tabs>
```

<!-- demo: tabs-product -->

- **Skryté panely zůstávají ve stránce.** Prvky formuláře v nich drží hodnoty a kontrolují se, i když jejich záložka není vidět.
- **Chyba přepne záložku.** Když neprojde kontrola, otevře se záložka s prvním chybným prvkem a fokus jde do něj. Záložka, v jejímž panelu je chyba, má červenou tečku a čtečka k ní přečte „obsahuje chybu“.
- **Co se nevejde, je pod „Další“.** Řada záložek se nezalamuje. Záložky, které se nevejdou, se schovají do rozbalovacího menu na konci řady. Zvolená záložka zůstane v řadě vždy, i když je to poslední záložka.
- **Ovládání podle WAI-ARIA:** do řady se jde tabulátorem, mezi záložkami šipkami, Home a End skočí na první a poslední. Šipka záložku rovnou zvolí.
- **Zvolená záložka** je index v `state`. Bez `selected` si ho záložky drží samy. S vlastním stavem jde záložku zvolit z kódu nebo zapamatovat: `selected={this.preference('product.tab', 0)}`.
- **Uvnitř `<Tabs>` smějí být jen `<Tab>`,** zapsané přímo, ne podmínkou `<If>`. `title` je text nebo šablona: ikona fontu, `<img>`, inline `<svg>`, komponenta i jejich kombinace s textem. Ukazuje se v záložce i v menu „Další“, šablona se pro každé místo vytvoří znovu. Hotový DOM uzel (`document.createElement`) tam nepatří, ve stránce může být jen jednou.
- **Vlastní kontejnery:** fokus do skrytého prvku funguje díky `reveal(element)`. `focus()` prvků formuláře ji volá samo, vlastní prvek ji zavolá před `element.focus()`. Kontejner, který se umí sám ukázat, poslouchá na sobě událost `phloxreveal`.
- **Vzhled:** místa `tabs`, `tabs.nav`, `tabs.tab`, `tabs.tabActive`, `tabs.more` a `tabs.panel`, v Bootstrapu `nav nav-tabs`, `nav-link`, `active` a `nav-link dropdown-toggle`. Texty „Další“ a „obsahuje chybu“ se překládají v `setTexts()` pod `tabs` (`more`, `hasErrors`).
