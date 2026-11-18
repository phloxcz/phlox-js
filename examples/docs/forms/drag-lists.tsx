import { Component, For, dragToSort, state } from '@phloxcz/phlox-js';
import type { SortList, State } from '@phloxcz/phlox-js';

interface Card { id: number; name: string }

/** dragToSort with `lists`: cards ordered within a column and dragged to another one, like a board of tasks. */
export default class Board extends Component {
  public readonly columns: { title: string; cards: State<Card[]>; element?: HTMLElement }[] = [
    { title: 'Udělat', cards: state([{ id: 1, name: 'Návrh' }, { id: 2, name: 'Rozpočet' }, { id: 3, name: 'Smlouva' }]) },
    { title: 'Dělá se', cards: state([{ id: 4, name: 'Vývoj' }]) },
    { title: 'Hotovo', cards: state([{ id: 5, name: 'Analýza' }]) },
  ];

  public render() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '.75rem' }}>
        {this.columns.map(column => (
          <div>
            <strong>{column.title}</strong>
            <ul ref={element => { column.element = element; }}
              style={{ display: 'grid', gap: '.4rem', minHeight: '6rem', margin: '.4rem 0 0', padding: '.4rem', listStyle: 'none', borderRadius: '8px', background: '#8881' }}>
              <For each={column.cards}>
                {card => {
                  let element!: HTMLElement;
                  return (
                    <li ref={el => { element = el; }}
                      style={{ padding: '.5rem', border: '1px solid #8886', borderRadius: '6px', background: 'Canvas', touchAction: 'none', cursor: 'grab' }}
                      onPointerdown={event => dragToSort(event, element, {
                        items: () => [...column.element!.children] as HTMLElement[],
                        move: to => column.cards.update(cards => {
                          const rest = cards.filter(other => other !== card);
                          rest.splice(to, 0, card);
                          return rest;
                        }),
                        list: column.element!,
                        // The other columns; letting go there takes the card from this one into that one
                        lists: () => this.columns.filter(other => other !== column).map((other): SortList => ({
                          element: other.element!,
                          items: () => [...other.element!.children] as HTMLElement[],
                          drop: to => {
                            column.cards.update(cards => cards.filter(item => item !== card));
                            other.cards.update(cards => cards.toSpliced(to, 0, card));
                          },
                        })),
                      })}>
                      ⠿ {card.name}
                    </li>
                  );
                }}
              </For>
            </ul>
          </div>
        ))}
      </div>
    );
  }
}
