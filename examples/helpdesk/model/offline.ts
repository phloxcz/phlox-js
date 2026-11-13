// What of the API works offline in the helpdesk: reading methods give back kept data, writing ones wait in a queue.
import { Preferences, state } from 'phlox-js';
import type { State } from 'phlox-js';
import { IndexedDbStore, MemoryStore, RpcOffline } from 'phlox-js/net';
import type { OfflineCache, OfflineRules } from 'phlox-js/net';
import { HelpdeskApi } from '../api';
import type { CommentResource, ProjectResource, RpcMethods, TaskDetail, TaskQuery } from '../api';
import { queryTasks, taskItem } from './queries';

/** The kept details of tasks: offline lists, counts and search are computed from them. */
async function keptTasks(cache: OfflineCache): Promise<TaskDetail[]> {
  return (await cache.all<TaskDetail>('task.read')).map(entry => entry.value);
}

/** The rules of the helpdesk. `me` is the signed-in user, for "my tasks" and the author of a comment. */
export function offlineRules(me: () => number): OfflineRules<RpcMethods> {
  return {
    reads: {
      'user.list': {},
      'project.list': {},
      'task.read': {},
      'comment.list': {},
      'attachment.list': {},
      'history.list': {},
      'report.projects': {},
      'notification.list': { offline: () => [] },
      // Lists with any tab, filter and order: computed from the kept tasks like the server does it
      'task.list': { offline: async ({ query }, cache) => queryTasks(await keptTasks(cache), query) },
      'task.mine': { offline: async (_params, cache) => (await keptTasks(cache)).filter(task => task.assigneeId === me() && task.status !== 'closed').length },
      'search.query': {
        offline: async ({ text }, cache) => {
          const words = text.trim().toLocaleLowerCase('cs');
          const projects = (await cache.get<ProjectResource[]>('project.list')) ?? [];
          return {
            projects: projects.filter(project => project.name.toLocaleLowerCase('cs').includes(words)),
            tasks: (await keptTasks(cache)).filter(task => task.title.toLocaleLowerCase('cs').includes(words))
              .map(task => ({ ...taskItem(task), projectName: task.projectName })),
          };
        },
      },
    },
    writes: {
      'task.update': {
        apply: async ({ id, input }, cache) => {
          const task: TaskDetail = { ...(await cache.get<TaskDetail>('task.read', { id }))!, ...input, updated: new Date().toISOString() };
          await cache.set('task.read', { id }, task);
          return task;
        },
        // The time of the last change on the server: changed meanwhile means the user is asked before sending
        version: async ({ id }, cache) => (await cache.get<TaskDetail>('task.read', { id }))?.updated,
        current: async ({ id }, call) => ((await call('task.read', { id })) as TaskDetail).updated,
        describe: async ({ id }, cache) => `Změna úkolu „${(await cache.get<TaskDetail>('task.read', { id }))?.title ?? id}“`,
      },
      'comment.create': {
        apply: async ({ taskId, text }, cache) => {
          const comment: CommentResource = { id: -Date.now(), taskId, authorId: me(), text: text.trim(), created: new Date().toISOString(), likes: 0, liked: false };
          const comments = (await cache.get<CommentResource[]>('comment.list', { taskId })) ?? [];
          await cache.set('comment.list', { taskId }, [comment, ...comments]);
          const task = await cache.get<TaskDetail>('task.read', { id: taskId });
          if (task) await cache.set('task.read', { id: taskId }, { ...task, commentCount: task.commentCount + 1 });
          return comment;
        },
        describe: async ({ taskId, text }, cache) =>
          `Komentář k úkolu „${(await cache.get<TaskDetail>('task.read', { id: taskId }))?.title ?? taskId}“: ${text.slice(0, 40)}`,
      },
    },
  };
}

/** The offline layer of the helpdesk; a class of its own, so services find it by type (generics are not autowired). */
export class HelpdeskOffline extends RpcOffline<RpcMethods> {}

/** The offline layer: IndexedDB in the browser, memory where there is none (tests in jsdom). */
export function createOffline(me: () => number): HelpdeskOffline {
  const store = typeof indexedDB === 'undefined' ? new MemoryStore() : new IndexedDbStore('phlox-helpdesk');
  return new HelpdeskOffline(store, offlineRules(me), () => String(me()));
}

/** Preparing tasks for working offline, and which lists are prepared. */
export class OfflineWork {
  /** Prepared lists by their keys: a project by its id, 'mine' for my tasks. Remembered in the browser. */
  readonly prepared: State<string[]>;
  /** The key of the list being prepared now. */
  readonly preparing = state<string | null>(null);

  constructor(readonly offline: HelpdeskOffline, private api: HelpdeskApi, preferences: Preferences) {
    this.prepared = preferences.state<string[]>('helpdesk.offline.prepared', []);
  }

  /**
   * Downloads everything for working offline with the tasks of the query: the common data, the list
   * and the detail, comments, attachments and history of each task. Returns how many tasks.
   */
  async prepare(key: string, query: TaskQuery): Promise<number> {
    this.preparing.set(key);
    try {
      const page = await this.api.call('task.list', { query });
      await this.offline.download([
        ['user.list'], ['project.list'], ['task.mine'], ['notification.list'], ['report.projects'],
        ...page.data.flatMap(task => [
          ['task.read', { id: task.id }],
          ['comment.list', { taskId: task.id }],
          ['attachment.list', { taskId: task.id }],
          ['history.list', { taskId: task.id }],
        ] as [keyof RpcMethods & string, object][]),
      ]);
      this.prepared.update(keys => (keys.includes(key) ? keys : [...keys, key]));
      return page.data.length;
    } finally {
      this.preparing.set(null);
    }
  }
}
