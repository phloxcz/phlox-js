import { Button, Component, For, state } from '@phloxcz/phlox-js';
import { RpcClient, RpcError, createRpcMock } from '@phloxcz/phlox-js/net';
import { RpcMockError } from '@phloxcz/phlox-js/net';

interface Task { id: number; title: string }

/** The methods of the API, in the shape `npm run rpc:types` generates from phlox-rpc-api. */
interface Methods {
  'task.read': { params: { id: number }; result: Task };
  'task.create': { params: { title: string }; result: Task };
  'task.count': { params: Record<string, never>; result: number };
}

const tasks: Task[] = [{ id: 1, title: 'Opravit přihlášení' }, { id: 2, title: 'Export do PDF' }];

/** A server in the browser: a table of methods answering like phlox-rpc-api (batches, errors with fields). */
const server = createRpcMock<Methods>({
  'task.read': ({ id }) => {
    const task = tasks.find(other => other.id === id);
    if (!task) throw new RpcMockError(404, `Úkol ${id} neexistuje.`);
    return task;
  },
  'task.create': ({ title }) => {
    if (!title.trim()) throw new RpcMockError(-32602, 'Invalid params', { title: 'Vyplňte název.' });
    const task = { id: tasks.length + 1, title };
    tasks.push(task);
    return task;
  },
  'task.count': () => tasks.length,
}, { latency: 300 });

/** In an application this is the generated RpcApi, registered as a service. */
const api = new RpcClient<Methods>('/rpc', { fetch: server.fetch });

/** Calls made at once go as one request; every failure is an RpcError with a code. */
export default class RpcDemo extends Component {
  public readonly log = state<string[]>([]);

  public write(line: string) {
    this.log.update(log => [...log.slice(-6), line]);
  }

  public async batch() {
    const before = server.calls.length;
    const [first, second, count] = await Promise.all([api.call('task.read', { id: 1 }), api.call('task.read', { id: 2 }), api.call('task.count', {})]);
    this.write(`3 volání, ${server.calls.length - before} metody v jednom požadavku: ${first.title}, ${second.title}, celkem ${count}`);
  }

  public async failing() {
    try {
      await api.call('task.create', { title: '' });
    } catch (error) {
      if (error instanceof RpcError) this.write(`RpcError ${error.code}: ${JSON.stringify(error.data.fields)}`);
    }
    try {
      await api.call('task.read', { id: 99 });
    } catch (error) {
      if (error instanceof RpcError) this.write(`RpcError ${error.code}: ${error.message}`);
    }
  }

  public render() {
    return (
      <div>
        <p style={{ display: 'flex', gap: '.5rem' }}>
          <Button onClick={() => this.batch()}>Tři volání najednou</Button>
          <Button onClick={() => this.failing()}>Chyby</Button>
        </p>
        <ul><For each={this.log}>{line => <li><code>{line}</code></li>}</For></ul>
      </div>
    );
  }
}
