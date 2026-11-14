# Dialogy a panely

V dialogu se dá otevřít jakákoli komponenta. Sama určuje titulek a tlačítka a zavírá se přes `this.close(výsledek)`. Typ výsledku je druhý typový parametr.

```tsx
class UserEdit extends Component<{ userId: number }, boolean> {
  name = state('');

  constructor(private api: UserApi) {
    super();
  }

  override async startup() {
    this.name.set((await this.api.get(this.props.userId)).name);
  }

  override title() {
    return 'Úprava uživatele';
  }

  override actions() {
    return (
      <>
        <button onClick={() => this.close(false)}>Zrušit</button>
        <button onClick={() => this.handleSave()}>Uložit</button>
      </>
    );
  }

  async handleSave() {
    await this.api.save(this.props.userId, this.name());
    this.close(true);
  }

  render() {
    return <input value={this.name} onInput={event => this.name.set(event.currentTarget.value)} />;
  }
}
```

## Dialog bez URL

Pro potvrzení, výběr nebo krátký formulář. `openDialog` počká na zavření a vrátí výsledek:

```ts
const saved = await this.openDialog(UserEdit, { userId: 15 });
if (saved) await this.reload();
```

<!-- demo: dialog-edit -->

Zavření křížkem, klávesou Escape nebo klikem vedle okna vrátí `undefined`. Dialog zmizí i s komponentou, která ho otevřela.

## Panel z boku

Velký formulář se hodí spíš do panelu, který vyjede zprava přes celou výšku (jako offcanvas v Bootstrapu). Rozhoduje to ten, kdo dialog otevírá, třetím parametrem:

```ts
await this.openDialog(ProjectEdit, {}, { placement: 'end' });

// u routy jako třetí položka
{ name: 'edit', pattern: '/<id \\d+>', dialog: ({ id }) => [ItemEdit, { id: Number(id) }, { placement: 'end' }] }
```

- **`placement`:** `center` (výchozí, okno uprostřed), `end` (panel zprava), `start` (zleva). Panel má hlavičku a patičku na místě a posouvá se jen tělo.
- **`class`:** třídy okna, třeba pro šířku. Šířku panelu mění i proměnná `--phlox-panel-width` (výchozí `min(36rem, 100vw)`).
- **Komponenta se nemění,** stejná může být jednou v okně a jindy v panelu.
