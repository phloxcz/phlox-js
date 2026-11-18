/**
 * Czech texts of the framework for setTexts():
 *
 *   import { setTexts } from '@phloxcz/phlox-js';
 *   import cs from '@phloxcz/phlox-js/locales/cs';
 *   setTexts(cs);
 *
 * Only data: the parts of the framework take their texts when they are loaded.
 */

import type { FrameworkTexts } from '../ui/texts';

const cs: FrameworkTexts = {
  messages: {
    ok: 'OK', cancel: 'Zrušit', close: 'Zavřít', loading: 'Načítám…',
    unsaved: 'Odejít bez uložení změn?', leave: 'Odejít',
  },
  grid: {
    search: 'Hledat…', reset: 'Zrušit filtry', filter: 'Filtr', all: 'Vše', yes: 'Ano', no: 'Ne', apply: 'Použít',
    from: 'Od', to: 'Do', clearFilter: 'Zrušit filtr', noData: 'Žádné záznamy', loading: 'Načítám…',
    shown: '%d–%d z %d', perPage: 'Řádků na stránku', first: 'První stránka', previous: 'Předchozí stránka',
    next: 'Další stránka', last: 'Poslední stránka', page: 'Stránka %d', columns: 'Sloupce', moveLeft: 'Posunout doleva',
    moveRight: 'Posunout doprava', selected: 'Vybráno: %d', selectAll: 'Vybrat vše na stránce', selectRow: 'Vybrat řádek',
    actions: 'Akce', sortBy: 'Řadit podle %s', resize: 'Změnit šířku sloupce %s',
    sum: 'Celkem', avg: 'Průměr', count: 'Počet', min: 'Nejméně', max: 'Nejvíc',
  },
  tabs: { more: 'Další', hasErrors: 'obsahuje chybu' },
  tree: { expand: 'Rozbalit', collapse: 'Sbalit', loading: 'Načítám…' },
  dropdownlist: { noResults: 'Nic nenalezeno', filterPlaceholder: 'Hledat…' },
  combobox: { noResults: 'Nic nenalezeno' },
  dropdowntree: { clear: 'Vymazat' },
  multiplier: {
    add: 'Přidat', remove: 'Odebrat', moveUp: 'Posunout nahoru', moveDown: 'Posunout dolů',
    drag: 'Přetažením nebo šipkami změníte pořadí', min: 'Přidejte aspoň %d řádky.', max: 'Řádků může být nejvýš %d.',
  },
  taginput: { createNew: 'Vytvořit: ', remove: 'Odebrat' },
  upload: {
    dropzone: 'Oblast pro nahrání – klikněte nebo sem přetáhněte soubory', heading: 'Přetáhněte soubory sem', or: 'nebo',
    browseMultiple: 'Vybrat soubory', browseSingle: 'Vybrat soubor', remove: 'Odebrat %s',
  },
  rules: {
    Filled: 'Toto pole je povinné.',
    Blank: 'Toto pole by mělo být prázdné.',
    Equal: 'Zadejte %s.',
    NotEqual: 'Tato hodnota by neměla být %s.',
    MinLength: 'Zadejte prosím alespoň %d znaků.',
    MaxLength: 'Zadejte prosím maximálně %d znaků.',
    Length: 'Zadejte prosím hodnotu %d až %d znaků dlouhou.',
    Email: 'Zadejte platnou e-mailovou adresu.',
    URL: 'Zadejte platné URL.',
    Pattern: 'Zadejte hodnotu v požadovaném formátu.',
    Integer: 'Zadejte platné celé číslo.',
    Float: 'Zadejte platné číslo.',
    Min: 'Zadejte prosím hodnotu větší nebo rovnou %d.',
    Max: 'Zadejte prosím hodnotu menší nebo rovnou %d.',
    Range: 'Zadejte hodnotu mezi %d a %d.',
    IsIn: 'Zvolte jednu z povolených hodnot.',
    MaxFileSize: 'Velikost nahraného souboru může být nejvýše %d bajtů.',
    MimeType: 'Nahraný soubor nemá očekávaný formát.',
    Image: 'Nahraný soubor musí být obrázek ve formátu JPEG, GIF, PNG, WebP nebo AVIF.',
  },
};

export default cs;
