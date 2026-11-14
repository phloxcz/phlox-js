// Data for the demos of selections: people and a search like on a server (it waits, filters, returns the first ones).
import { foldText } from '@phloxcz/phlox-js/forms';

export interface Person { id: number; name: string; team: string }

const FIRST = ['Jana', 'Petr', 'Eva', 'Tomáš', 'Lucie', 'Martin', 'Zuzana', 'Jiří', 'Kateřina', 'Ondřej'];
const LAST = ['Nováková', 'Svoboda', 'Dvořáková', 'Černý', 'Procházková', 'Kučera', 'Veselá', 'Horák', 'Němcová', 'Marek'];
const TEAMS = ['Vývoj', 'Podpora', 'Obchod'];

export const PEOPLE: Person[] = Array.from({ length: 300 }, (_, i) => ({
  id: i + 1,
  name: `${FIRST[i % 10]} ${LAST[Math.floor(i / 10) % 10]} ${i >= 100 ? Math.floor(i / 100) : ''}`.trim(),
  team: TEAMS[i % 3]!,
}));

/** Like user.search on a server: the first 20 matching people after 300 ms. */
export async function searchPeople(text: string): Promise<Person[]> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const folded = foldText(text);
  return PEOPLE.filter(person => foldText(person.name).includes(folded)).slice(0, 20);
}

/** Like user.read: the person with the id. */
export async function readPerson(id: number): Promise<Person> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return PEOPLE.find(person => person.id === id)!;
}
