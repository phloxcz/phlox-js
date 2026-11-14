import { Button, Component, For, If, state } from '@phloxcz/phlox-js';
import { MemoryStore, RpcClient, RpcOffline, createRpcMock } from '@phloxcz/phlox-js/net';

interface Note { id: number; text: string; updated: string }

interface Methods {
  'note.read': { params: { id: number }; result: Note };
  'note.update': { params: { id: number; text: string }; result: Note };
}

const now = () => new Date().toISOString();
/** The record on the server, a state so the demo shows it. */
const stored = state<Note>({ id: 1, text: 'Zkontrolovat kotel', updated: now() });
const change = (text: string) => stored.set({ ...stored(), text, updated: now() });

const server = createRpcMock<Methods>({
  'note.read': () => ({ ...stored() }),
  'note.update': ({ text }) => {
    change(text);
    return { ...stored() };
  },
}, { latency: 200 });

/** The network of the demo: switched off, every request fails like without a signal. */
const network = state(true);

/**
 * Rules of the application: what is kept for offline (reads) and how a change is shown offline and checked
 * before sending (writes). In an application with IndexedDbStore, here in memory.
 */
const offline = new RpcOffline<Methods>(new MemoryStore(), {
  reads: { 'note.read': {} },
  writes: {
    'note.update': {
      apply: async ({ id, text }, cache) => {
        const note = { ...(await cache.get<Note>('note.read', { id }))!, text };
        await cache.set('note.read', { id }, note);
        return note;
      },
      version: async ({ id }, cache) => (await cache.get<Note>('note.read', { id }))?.updated,
      current: async ({ id }, call) => ((await call('note.read', { id })) as Note).updated,
      describe: ({ text }) => `Poznámka: ${text}`,
    },
  },
});

const api = new RpcClient<Methods>('/rpc', {
  offline,
  fetch: (url, init) => (network() ? server.fetch(url, init) : Promise.reject(new TypeError('Failed to fetch'))),
});

/** Without a network the change waits in the queue; a record changed on the server meanwhile asks first. */
export default class OfflineDemo extends Component {
  readonly note = state<Note | null>(null);
  readonly draft = state('');

  override async startup() {
    await this.load();
    this.scope.onCleanup(offline.onSynced(() => void this.load()));
  }

  async load() {
    const note = await api.call('note.read', { id: 1 });
    this.note.set(note);
    this.draft.set(note.text);
  }

  async save() {
    this.note.set(await api.call('note.update', { id: 1, text: this.draft() }));
  }

  render() {
    return (
      <div>
        <p style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', alignItems: 'center' }}>
          <label><input type="checkbox" checked={network} onChange={event => network.set(event.currentTarget.checked)} /> Síť</label>
          <input value={this.draft} onInput={event => this.draft.set(event.currentTarget.value)} />
          <Button primary onClick={() => this.save()}>Uložit</Button>
          <Button onClick={() => offline.sync()} disabled={() => !network() || offline.pending().length === 0}>Odeslat frontu</Button>
          <Button small onClick={() => change('Změněno v kanceláři')}>Změnit na serveru</Button>
        </p>
        <p>Uloženo: <strong>{() => this.note()?.text}</strong>, na serveru: {() => stored().text}</p>
        <If when={() => offline.pending().length > 0}>
          <p>Čeká na odeslání: <For each={offline.pending}>{waiting => <code>{waiting.title} </code>}</For></p>
        </If>
        <For each={offline.conflicts}>
          {conflict => (
            <p>
              Záznam se mezitím změnil: <code>{conflict.title}</code>{' '}
              <Button small onClick={() => offline.resolve(conflict, 'send')}>Uložit i tak</Button>{' '}
              <Button small onClick={() => offline.resolve(conflict, 'drop')}>Zahodit</Button>
            </p>
          )}
        </For>
        <p><small>Vypněte síť, uložte, klikněte Změnit na serveru, zapněte síť a odešlete frontu.</small></p>
      </div>
    );
  }
}
