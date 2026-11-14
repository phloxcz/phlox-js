import { Component, For, dragToSort, state } from '@phloxcz/phlox-js';

interface Card { id: number; name: string }

/** dragToSort for any list: cards in a grid that wraps; the order is in the data, <For> moves the elements. */
export default class Cards extends Component {
  readonly cards = state<Card[]>(['Návrh', 'Vývoj', 'Testy', 'Nasazení', 'Dokumentace', 'Školení'].map((name, id) => ({ id, name })));
  readonly saved = state('');

  render() {
    let list!: HTMLElement;
    return (
      <div>
        <ul ref={element => { list = element; }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(8rem, 1fr))', gap: '.5rem', padding: '0', listStyle: 'none' }}>
          <For each={this.cards}>
            {card => {
              let element!: HTMLElement;
              return (
                <li ref={el => { element = el; }}
                  style={{ padding: '.6rem', border: '1px solid #8886', borderRadius: '8px', background: 'Canvas', touchAction: 'none', cursor: 'grab' }}
                  // The whole card is the handle
                  onPointerdown={event => dragToSort(event, element, {
                    items: () => [...list.children] as HTMLElement[],
                    layout: 'grid',
                    move: to => this.cards.update(cards => {
                      const rest = cards.filter(other => other !== card);
                      rest.splice(to, 0, card);
                      return rest;
                    }),
                    done: () => this.saved.set(this.cards().map(c => c.name).join(', ')),
                  })}>
                  ⠿ {card.name}
                </li>
              );
            }}
          </For>
        </ul>
        <p><small>Uložené pořadí: {this.saved}</small></p>
      </div>
    );
  }
}
