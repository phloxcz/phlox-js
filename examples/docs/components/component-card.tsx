import { Component, For, state } from 'phlox-js';
import type { Child, Container } from 'phlox-js';

interface User { id: number; name: string; role: string }

/** A stand-in for an API: answers after a while, like a server. */
class UserApi {
  async get(id: number): Promise<User> {
    await new Promise(resolve => setTimeout(resolve, 300 + id * 200));
    return { id, name: ['Jana Nováková', 'Petr Svoboda', 'Eva Dvořáková'][id - 1]!, role: id === 1 ? 'správce' : 'uživatel' };
  }
}

export function services(container: Container) {
  container.add(UserApi);
}

/** Props from the tag, a service in the constructor, data loaded in startup(), content between the tags. */
class UserCard extends Component<{ userId: number; children?: Child }> {
  readonly detail = state<User | null>(null);

  constructor(private api: UserApi) {
    super();
  }

  override async startup() {
    this.detail.set(await this.api.get(this.props.userId));
  }

  render() {
    return (
      <article style={{ border: '1px solid #8886', borderRadius: '8px', padding: '.5rem .75rem' }}>
        <strong>{() => this.detail()?.name}</strong> ({() => this.detail()?.role})
        <div>{this.props.children}</div>
      </article>
    );
  }
}

/** startup() is async: every card shows once its data are there. */
export default class Cards extends Component {
  render() {
    return (
      <div style={{ display: 'grid', gap: '.5rem' }}>
        <For each={() => [1, 2, 3]}>
          {id => <UserCard userId={id}><small>karta {id}</small></UserCard>}
        </For>
      </div>
    );
  }
}
