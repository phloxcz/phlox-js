# Rozbalovací panel: Dropdown

Tlačítko s panelem libovolného obsahu: menu uživatele, upozornění, filtr.

```tsx
import { Dropdown, DropdownItem } from '@phloxcz/phlox-js';

<Dropdown label={<Icon name="bell" />} title="Upozornění" placement="bottom-right" onOpen={() => this.load()}>
  <For each={this.items}>{item => <DropdownItem href={this.link(`/tasks/${item.taskId}`)}>{item.text}</DropdownItem>}</For>
</Dropdown>
```

<!-- demo: dropdown-panel -->

- **Zavření:** klik na odkaz nebo tlačítko v panelu, klik mimo, Escape (zavře jen panel, ne dialog pod ním) nebo druhý klik na tlačítko. Po Escape se fokus vrátí na tlačítko. Zaškrtávátka a pole panel nechají otevřený.
- **Obsah se tvoří při každém otevření** a při zavření se uklidí. `onOpen` se hodí pro načtení dat.
- **Umístění** jako u popoveru: `placement` (`bottom-left` výchozí, `bottom-right`, `top-left`, `top-right`), otočí se, když se nevejde, a posuvný kontejner ho neořízne.
- **Volby:** `label` (obsah tlačítka), `title` (název pro čtečky, když je v tlačítku jen ikona), `class` (třídy tlačítka, může být funkce), `panelClass`.
- **Položky menu:** `<DropdownItem>` je odkaz (s `href`) nebo tlačítko (s `onClick`) s třídou tématu, ve výchozím tématu `phlox-dropdown-item`, v Bootstrapu `dropdown-item`. `active` označí aktuální volbu (`aria-current`, `aria-pressed`), `disabled` ji zakáže. Jiný obsah panelu (zaškrtávátka, formulář) se píše přímo.
- **Vzhled:** místa `dropdown.button`, `dropdown.panel`, `dropdown.item` a `dropdown.itemActive`, v Bootstrapu `btn`, `dropdown-menu`, `dropdown-item` a `active`.
