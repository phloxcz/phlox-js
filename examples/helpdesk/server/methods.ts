// Methods of the mock server, as controllers of phlox-rpc-api would have them. `me` is the logged-in user.
import { Buffer } from 'node:buffer';
import { JSDOM } from 'jsdom';
import type { AttachmentResource, CommentResource, ProjectResource, RpcMethods, Status, TaskDetail } from '../api.ts';
import { RpcMockError } from '../../../src/net/mock.ts';
import { sanitizeHtml } from '../../../src/ui/sanitize.ts';
import { queryTasks, taskItem } from '../model/queries.ts';
import { seed } from './data.ts';
import type { Database } from './data.ts';

export let db: Database = seed();

/** Back to the data of the start, e.g. before every test. */
export function resetDatabase(): void {
  db = seed();
  tokens.clear();
}

const STATUS_NAMES: Record<Status, string> = { open: 'Otevřený', progress: 'V řešení', closed: 'Uzavřený' };
const now = () => new Date().toISOString();
// Comments are HTML from the editor: cleaned the same way <Html> cleans them in the browser
const server = new JSDOM('').window.document;
const clean = (html: string) => sanitizeHtml(html, { document: server }).trim();
const textOf = (html: string) => html.replace(/<[^>]*>|&nbsp;/g, '').trim();
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function invalid(fields: Record<string, string>): never {
  throw new RpcMockError(-32602, 'Invalid params', fields);
}

function find<T extends { id: number }>(list: T[], id: number, what: string): T {
  const item = list.find(other => other.id === id);
  if (!item) throw new RpcMockError(404, `${what} ${id} neexistuje.`);
  return item;
}

const user = (id: number) => {
  const { password: _, ...rest } = find(db.users, id, 'Uživatel');
  return rest;
};

const project = (id: number): ProjectResource => {
  const item = find(db.projects, id, 'Projekt');
  return { ...item, taskCount: db.tasks.filter(task => task.projectId === id).length };
};


const taskDetail = (id: number): TaskDetail => {
  const task = find(db.tasks, id, 'Úkol');
  return {
    ...task,
    projectName: find(db.projects, task.projectId, 'Projekt').name,
    commentCount: db.comments.filter(comment => comment.taskId === id).length,
    attachmentCount: db.attachments.filter(attachment => attachment.taskId === id).length,
  };
};

const comment = (me: number, { likedBy, ...rest }: Database['comments'][number]): CommentResource =>
  ({ ...rest, likes: likedBy.length, liked: likedBy.includes(me) });

const attachment = ({ content: _, ...rest }: Database['attachments'][number]): AttachmentResource =>
  ({ ...rest, url: `/helpdesk/files/${rest.id}/${encodeURIComponent(rest.name)}` });

/** Parts of uploads in progress, by uploadId. */
const uploads = new Map<string, string[]>();

/** Tokens of logged-in users. */
export const tokens = new Map<string, number>();

type Handlers = { [K in keyof RpcMethods]: (params: RpcMethods[K]['params'], me: number) => RpcMethods[K]['result'] };

export const methods: Handlers = {
  'sign.in': ({ email, password }) => {
    const found = db.users.find(other => other.email === email.trim().toLowerCase());
    if (!found || found.password !== password) throw new RpcMockError(401, 'Nesprávný e-mail nebo heslo.');
    const token = `hd-${found.id}-${Math.random().toString(36).slice(2)}`;
    tokens.set(token, found.id);
    return { token, user: user(found.id) };
  },

  'user.list': () => db.users.map(other => user(other.id)),

  'user.updateProfile': ({ input }, me) => {
    if (!input.name.trim()) invalid({ 'input.name': 'Jméno je povinné.' });
    Object.assign(find(db.users, me, 'Uživatel'), { name: input.name.trim(), title: input.title.trim() });
    return user(me);
  },

  'project.list': () => db.projects.map(item => project(item.id)),

  'project.create': ({ input }) => {
    const name = input.name.trim();
    if (!name) invalid({ 'input.name': 'Název je povinný.' });
    if (db.projects.some(other => fold(other.name) === fold(name))) invalid({ 'input.name': 'Projekt s tímto názvem už existuje.' });
    const id = ++db.lastId;
    db.projects.push({ id, name, subtitle: input.subtitle.trim(), color: input.color });
    return project(id);
  },

  'task.list': ({ query }) => queryTasks(db.tasks, query),

  'task.read': ({ id }) => taskDetail(id),

  'task.update': ({ id, input }, me) => {
    const task = find(db.tasks, id, 'Úkol');
    if (!STATUS_NAMES[input.status]) invalid({ 'input.status': 'Neznámý stav.' });
    if (input.assigneeId !== null) find(db.users, input.assigneeId, 'Uživatel');
    if (input.due !== null && !/^\d{4}-\d{2}-\d{2}$/.test(input.due)) invalid({ 'input.due': 'Termín má formát RRRR-MM-DD.' });
    const name = (userId: number | null) => (userId === null ? null : user(userId).name);
    const changes: [field: 'status' | 'priority' | 'assignee' | 'due', from: string | null, to: string | null][] = [];
    if (task.status !== input.status) changes.push(['status', task.status, input.status]);
    if (task.priority !== input.priority) changes.push(['priority', task.priority, input.priority]);
    if (task.assigneeId !== input.assigneeId) changes.push(['assignee', name(task.assigneeId), name(input.assigneeId)]);
    if (task.due !== input.due) changes.push(['due', task.due, input.due]);
    if (!changes.length) return taskDetail(id);
    Object.assign(task, input, { updated: now() });
    for (const [field, from, to] of changes) db.history.push({ id: ++db.lastId, taskId: id, authorId: me, field, from, to, created: task.updated });
    if (input.assigneeId !== null && input.assigneeId !== me && changes.some(([field]) => field === 'assignee')) {
      db.notifications.push({
        id: ++db.lastId, userId: input.assigneeId, taskId: id, projectId: task.projectId,
        text: `${user(me).name} vám přiřadil(a) úkol ${task.title}`, created: task.updated, read: false,
      });
    }
    return taskDetail(id);
  },

  'task.mine': (_, me) => db.tasks.filter(task => task.assigneeId === me && task.status !== 'closed').length,

  'comment.list': ({ taskId }, me) => db.comments.filter(item => item.taskId === taskId)
    .sort((a, b) => b.created.localeCompare(a.created)).map(item => comment(me, item)),

  'comment.create': ({ taskId, text }, me) => {
    const task = find(db.tasks, taskId, 'Úkol');
    const html = clean(text);
    if (!textOf(html) && !/<img/.test(html)) invalid({ text: 'Napište text komentáře.' });
    if (textOf(html).length > 2000) invalid({ text: 'Komentář může mít nejvýš 2000 znaků.' });
    const item = { id: ++db.lastId, taskId, authorId: me, text: html, created: now(), likedBy: [] };
    db.comments.push(item);
    task.updated = item.created;
    return comment(me, item);
  },

  'comment.like': ({ id }, me) => {
    const item = find(db.comments, id, 'Komentář');
    item.likedBy = item.likedBy.includes(me) ? item.likedBy.filter(other => other !== me) : [...item.likedBy, me];
    return comment(me, item);
  },

  'attachment.list': ({ taskId }) => db.attachments.filter(item => item.taskId === taskId)
    .sort((a, b) => b.created.localeCompare(a.created)).map(attachment),

  'attachment.chunk': ({ taskId, uploadId, name, type, index, total, data }, me) => {
    find(db.tasks, taskId, 'Úkol');
    const parts = uploads.get(uploadId) ?? [];
    parts[index] = data;
    uploads.set(uploadId, parts);
    if (parts.filter(part => part !== undefined).length < total) return null;
    uploads.delete(uploadId);
    const content = Buffer.concat(parts.map(part => Buffer.from(part, 'base64')));
    if (content.length > 5 * 1024 * 1024) invalid({ file: 'Soubor může mít nejvýš 5 MB.' });
    const item = { id: ++db.lastId, taskId, authorId: me, name, type: type || 'application/octet-stream', size: content.length, content, created: now() };
    db.attachments.push(item);
    db.history.push({ id: ++db.lastId, taskId, authorId: me, field: 'attachment', from: null, to: name, created: item.created });
    return attachment(item);
  },

  'history.list': ({ taskId }) => db.history.filter(item => item.taskId === taskId).sort((a, b) => b.created.localeCompare(a.created)),

  'notification.list': (_, me) => db.notifications.filter(item => item.userId === me)
    .sort((a, b) => b.created.localeCompare(a.created)).map(({ userId: _, ...rest }) => rest),

  'notification.markRead': ({ ids }, me) => {
    for (const item of db.notifications) if (item.userId === me && ids.includes(item.id)) item.read = true;
    return null;
  },

  'search.query': ({ text }) => {
    const words = fold(text.trim());
    if (!words) return { projects: [], tasks: [] };
    return {
      projects: db.projects.filter(item => fold(item.name).includes(words)).slice(0, 5).map(item => project(item.id)),
      tasks: db.tasks.filter(task => fold(task.title).includes(words)).slice(0, 8)
        .map(task => ({ ...taskItem(task), projectName: find(db.projects, task.projectId, 'Projekt').name })),
    };
  },

  'report.projects': () => {
    const today = new Date().toISOString().slice(0, 10);
    return db.projects.map(item => {
      const tasks = db.tasks.filter(task => task.projectId === item.id);
      const count = (status: Status) => tasks.filter(task => task.status === status).length;
      return {
        projectId: item.id, name: item.name, color: item.color, open: count('open'), progress: count('progress'), closed: count('closed'),
        overdue: tasks.filter(task => task.status !== 'closed' && task.due !== null && task.due < today).length,
      };
    });
  },

  'support.contact': ({ input }) => {
    if (input.message.trim().length < 10) invalid({ 'input.message': 'Popište problém aspoň deseti znaky.' });
    return null;
  },
};
