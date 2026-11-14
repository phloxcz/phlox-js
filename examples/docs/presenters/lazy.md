# Líné načítání presenterů

```ts
{ name: 'projects', pattern: '/projects', presenter: ProjectsPresenter },                 // v hlavním balíku
{ name: 'reports', pattern: '/reports', presenter: () => import('./ReportsPresenter') },  // až při první návštěvě
```

<!-- demo: lazy-routes -->

- **Třída** je v hlavním balíku JavaScriptu, který prohlížeč stáhne hned při startu.
- **Funkce s `import()`** z presenteru udělá samostatný soubor (Vite ho oddělí sám). Prohlížeč ho stáhne, až uživatel na routu poprvé přijde. Router na něj počká jako na jinou přípravu obrazovky a stará obrazovka mezitím zůstává.
- **Kdy co:** co je na první obrazovce nebo skoro všude, importuj přímo, jinak by start čekal na další požadavek. Co je stranou (nastavení, reporty, administrace), načítej líně. V aplikaci se stovkou obrazovek to rozhoduje o velikosti prvního načtení.
- **Líně načítaný soubor** musí presenter exportovat jako `default`: `export default class ReportsPresenter extends Presenter`. Typy hlídá kompilátor stejně.
