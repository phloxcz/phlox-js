# Strom

Strom jako [phloxcz/components-tree](https://github.com/phloxcz/components-tree), se stejným HTML, třídami a CSS. Importuje se z `phlox-js/components`. Stejně jako u formuláře je zvlášť model (`Tree`) a vykreslení (`<TreeView>`).

```tsx
import { Tree, TreeView } from 'phlox-js/components';

class CategoriesPresenter extends Presenter {
  override routes: Route[] = [
    { name: 'default', pattern: '/' },
    { name: 'detail', pattern: '/<id \\d+>' },
  ];

  tree = new Tree<CategoryNode>({
    load: parent => this.api.call('category.children', { parentId: parent?.id ?? null }),
    path: id => this.api.call('category.path', { id }),
    remember: 'categories',
    draggable: true,
    move: ({ node, parent, index }) => this.api.call('category.move', { id: node.id, parentId: parent?.id ?? null, index }),
  });

  constructor(private api: RpcApi) {
    super();
  }

  override async startup() {
    await this.tree.load();
  }

  async actionDetail({ id }: Params) {
    await this.tree.select(Number(id));   // označí uzel a rozbalí cestu k němu
  }

  render() {
    return <TreeView tree={this.tree} lines href={node => this.link('detail', { id: node.id })} />;
  }
}
```

<!-- demo: tree-categories -->

## Uzly

Uzel je objekt s `id`, `label` a volitelně `children`, `hasChildren` a `disabled`. Další pole strom předává dál beze změny, takže typ uzlu může být rozšířený: `interface CategoryNode extends TreeNode<number> { locked?: boolean }`.

- **Najednou:** `new Tree({ nodes })`, děti v `children`. Uzel bez dětí je list.
- **Po úrovních:** `new Tree({ load })`. `load(null)` vrátí horní úroveň, `load(node)` děti uzlu, až když ho uživatel rozbalí. Uzel, který děti má, potřebuje `hasChildren: true`, jinak se nedá rozbalit. Děti uvedené v `children` se nenačítají.
- **`path(id)`** vrátí id předků uzlu od kořene. Bez něj umí `select()` a výběr ve formuláři ukázat jen uzel, který už je načtený.
- **`tree.load()`** načte horní úroveň jednou, `<TreeView>` ho zavolá sám. Když má být strom hotový dřív (třeba pro `select()` v akci), počkej na něj ve `startup()`. **`tree.reload()`** načte strom znovu, třeba po změně na serveru.

<!-- demo: tree-static -->

## Výběr a URL

- **Klik na uzel nebo Enter** uzel vybere (`tree.selected()`) a zavolá `tree.onSelect(node)`.
- **S `href`** je popisek odkaz a výběr uzlu na něj přejde. Router tak dostane URL uzlu a akce presenteru zavolá `tree.select(id)`. Výběr tedy vždy odpovídá URL, i po přímém odkazu, obnovení stránky a tlačítkách Zpět a Vpřed.
- **`tree.select(id)`** z kódu uzel označí a rozbalí cestu k němu. `onSelect` nevolá, aby výběr z URL znovu nenavigoval. `tree.select(null)` výběr zruší.
- **Zakázaný uzel** (`disabled`) nejde vybrat, zaškrtnout ani přetáhnout.

## Rozbalování a vzhled

- **Šipka u uzlu** ho rozbalí nebo sbalí, během načítání se ukáže kolečko a uzel má `aria-busy`. Když načtení selže, uzel zůstane sbalený a chyba jde do `app.onError`.
- **Rozbalení a sbalení se animuje,** délku dává CSS proměnná `--pt-anim-duration` (výchozí 180 ms, `0ms` animaci vypne). Zapnutí a vypnutí řídí `setMotion()` (viz Animace), ve výchozím stavu podle nastavení systému. Při prvním vykreslení se neanimuje.
- **`remember: 'klíč'`** si rozbalené uzly pamatuje v prohlížeči (`localStorage`). Po načtení se znovu rozbalí, u líného stromu i s načtením dětí.
- **Z kódu:** `tree.expand(item)`, `tree.collapse(item)`, `tree.toggle(item)`, `tree.reveal(id)` (rozbalí cestu bez výběru). `tree.find(id)` vrátí načtený uzel jako `TreeItem` se stavem: `expanded()`, `children()`, `loading()`, `parent()`, `hasChildren()`.
- **`<TreeView>`:** `lines` (spojovací čáry), `href`, `icon={(node, item) => ...}`, `label={node => ...}`, `aria-label`, `class`.
- **Vzhled** dodává téma: místa `tree.root`, `tree.row`, `tree.rowSelected`, `tree.toggle`, `tree.label`, `tree.pick` (zaškrtávátko nebo přepínač výběru, v Bootstrapu `form-check-input`). Rozměry jdou změnit proměnnými jako v PHP knihovně: `--pt-row-height`, `--pt-indent-width`, `--pt-font-size`… CSS je v `base.css` a nemá pevné barvy.
- **Texty:** `Tree.texts.expand`, `collapse`, `loading`.

## Klávesnice

Podle vzoru stromu z WAI-ARIA. Tabulátorem jde jen na jeden uzel (vybraný, jinak první), dál se pokračuje šipkami.

| Klávesa | Co udělá |
|---|---|
| ↓ ↑ | další a předchozí viditelný uzel |
| → | rozbalí uzel, na rozbaleném přejde na první dítě |
| ← | sbalí uzel, na sbaleném přejde na rodiče |
| Home, End | první a poslední viditelný uzel |
| Enter, mezerník | vybere uzel (s `href` na něj přejde), ve výběru ve formuláři ho zaškrtne |
| `*` | rozbalí všechny sourozence |
| písmena | přejde na uzel, který jimi začíná, bez ohledu na diakritiku |

## Přetahování

- **`draggable: true`**, nebo funkce, která řekne, které uzly jde přetáhnout: `draggable: node => !node.locked`.
- **Kam uzel půjde,** určuje poloha nad řádkem: horní čtvrtina znamená před uzel, dolní za něj, prostředek dovnitř jako poslední dítě. Místo ukazuje atribut `data-drop-pos` (`before`, `after`, `child`) a čára nebo rámeček. Kopie řádku jede vedle ukazatele, uzel zůstává na místě zesvětlený.
- **Sbalený uzel se rozbalí,** když nad jeho prostředkem tažený uzel chvíli zůstane. U okraje se seznam nebo stránka posouvá.
- **Nejde** pustit uzel na sebe, do svého podstromu ani znovu do svého rodiče. Escape tažení zruší.
- **`move({ node, target, position, parent, index })`** se zavolá po přesunu: `parent` je nový rodič (`null` pro horní úroveň) a `index` pozice mezi jeho dětmi. Když `move` skončí chybou (server přesun odmítl), uzel se vrátí na původní místo a chyba jde do `app.onError`.
- **Z kódu:** `await tree.move(item, target, 'child')`.
- **Prstem** se uzel přetahuje po podržení: prst musí chvíli (0,4 s) stát na místě, pak se objeví kopie řádku a telefon krátce zavibruje. Rychlý tah prstem dál posouvá stránku. Během tažení se stránka pod prstem neposouvá (kromě posouvání u okraje) a neotevře se nabídka prohlížeče.
