/**
 * The menu of the documentation: sections and their pages in order. A page is examples/docs/<section>/<page>.md,
 * its address /<section>/<page>.
 */

export interface Section {
  title: string;
  path: string;
  pages: { path: string; title: string }[];
}

export const CONTENTS: Section[] = [
  { title: 'Začínáme', path: 'start', pages: [
    { path: 'introduction', title: 'Úvod' },
    { path: 'application', title: 'Aplikace a bootstrap' },
    { path: 'services', title: 'Služby a DI' },
  ] },
  { title: 'Reaktivita a šablony', path: 'reactivity', pages: [
    { path: 'state', title: 'Reaktivní hodnoty' },
    { path: 'templates', title: 'Šablony' },
    { path: 'if', title: 'Podmínky' },
    { path: 'for', title: 'Seznamy' },
    { path: 'cleanup', title: 'Úklid' },
  ] },
  { title: 'Komponenty', path: 'components', pages: [
    { path: 'components', title: 'Komponenty' },
    { path: 'resource', title: 'Načítaná data' },
    { path: 'preferences', title: 'Nastavení a šířka sloupců' },
    { path: 'tabs', title: 'Záložky' },
  ] },
  { title: 'Presentery a routy', path: 'presenters', pages: [
    { path: 'presenters', title: 'Presentery a routy' },
    { path: 'actions', title: 'Akce, parametry a odkazy' },
    { path: 'typed-routes', title: 'Typované routy' },
    { path: 'persistent', title: 'Persistentní parametry' },
    { path: 'lazy', title: 'Líné načítání' },
    { path: 'navigation', title: 'Navigace a titulek' },
    { path: 'leave', title: 'Neuložené změny' },
  ] },
  { title: 'Dialogy a zprávy', path: 'dialogs', pages: [
    { path: 'dialogs', title: 'Dialogy a panely' },
    { path: 'routed', title: 'Dialog s URL' },
    { path: 'messages', title: 'Alert, confirm, prompt' },
    { path: 'flash', title: 'Flash zprávy' },
    { path: 'dropdown', title: 'Rozbalovací panel' },
  ] },
  { title: 'Formuláře', path: 'forms', pages: [
    { path: 'forms', title: 'Formuláře' },
    { path: 'controls', title: 'Prvky' },
    { path: 'rules', title: 'Pravidla a kontrola' },
    { path: 'rendering', title: 'Vykreslení' },
    { path: 'dropdownlist', title: 'DropDownList' },
    { path: 'combobox', title: 'ComboBox' },
    { path: 'taginput', title: 'TagInput' },
    { path: 'items', title: 'Položky a data výběrů' },
    { path: 'upload', title: 'Soubory' },
    { path: 'editor', title: 'WYSIWYG editor' },
    { path: 'tree-select', title: 'Výběr ze stromu' },
    { path: 'containers', title: 'Kontejnery a řádky' },
    { path: 'custom', title: 'Vlastní prvek' },
  ] },
  { title: 'Strom a grid', path: 'data', pages: [
    { path: 'tree', title: 'Strom' },
    { path: 'grid', title: 'Grid' },
  ] },
  { title: 'Server', path: 'server', pages: [
    { path: 'rpc', title: 'Volání serveru: RPC' },
    { path: 'offline', title: 'Práce offline' },
  ] },
  { title: 'Další', path: 'more', pages: [
    { path: 'user', title: 'Uživatel a oprávnění' },
    { path: 'translations', title: 'Překlady' },
    { path: 'themes', title: 'Vzhled a témata' },
    { path: 'html', title: 'HTML od uživatelů' },
    { path: 'testing', title: 'Testování' },
  ] },
  { title: 'Adaptéry', path: 'adapters', pages: [
    { path: 'adapters', title: 'Napojení jiných knihoven' },
    { path: 'kendo', title: 'Kendo UI' },
  ] },
];

/** Every page in the order of the menu, for "previous" and "next". */
export const PAGES = CONTENTS.flatMap(section => section.pages.map(page => ({ ...page, section, route: `/${section.path}/${page.path}` })));
