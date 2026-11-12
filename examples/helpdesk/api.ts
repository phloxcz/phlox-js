// Types of the helpdesk API in the shape `npm run rpc:types` generates from phlox-rpc-api.
// Written by hand here, because the server is a mock (see server/), and shared by the mock and the client.
import { RpcClient } from 'phlox-js/net';

export type Status = 'open' | 'progress' | 'closed';
export type Priority = 'low' | 'medium' | 'high';

export interface UserResource {
  id: number;
  name: string;
  email: string;
  /** Job title, e.g. "Vývojář". */
  title: string;
  /** Colour of the avatar. */
  color: string;
}

export interface SignInResult {
  token: string;
  user: UserResource;
}

export interface ProfileInput {
  name: string;
  title: string;
}

export interface ProjectResource {
  id: number;
  name: string;
  subtitle: string;
  color: string;
  taskCount: number;
}

export interface ProjectInput {
  name: string;
  subtitle: string;
  color: string;
}

export interface TaskResource {
  id: number;
  projectId: number;
  title: string;
  status: Status;
  priority: Priority;
  assigneeId: number | null;
  /** Format: date */
  due: string | null;
}

export interface TaskDetail extends TaskResource {
  projectName: string;
  description: string;
  category: string;
  /** Format: date-time */
  created: string;
  /** Format: date-time */
  updated: string;
  commentCount: number;
  attachmentCount: number;
}

/** What can be changed on a task. */
export interface TaskSettings {
  status: Status;
  priority: Priority;
  assigneeId: number | null;
  /** Format: date */
  due: string | null;
}

export interface TaskQuery {
  projectId?: number;
  /** Only tasks of this user; `me` in the client becomes the id of the user. */
  assigneeId?: number;
  status?: Status;
  priority?: Priority[];
  sort?: 'due' | 'priority';
}

export interface TaskCounts {
  all: number;
  open: number;
  progress: number;
  closed: number;
}

export interface TaskPage {
  data: TaskResource[];
  /** Counts for the tabs, without the filter of status. */
  counts: TaskCounts;
}

export interface CommentResource {
  id: number;
  taskId: number;
  authorId: number;
  text: string;
  /** Format: date-time */
  created: string;
  likes: number;
  /** The current user likes it. */
  liked: boolean;
}

export interface AttachmentResource {
  id: number;
  taskId: number;
  authorId: number;
  name: string;
  type: string;
  size: number;
  /** Format: date-time */
  created: string;
  url: string;
}

export interface HistoryResource {
  id: number;
  taskId: number;
  authorId: number;
  field: 'created' | 'status' | 'priority' | 'assignee' | 'due' | 'attachment';
  from: string | null;
  to: string | null;
  /** Format: date-time */
  created: string;
}

export interface NotificationResource {
  id: number;
  taskId: number;
  projectId: number;
  text: string;
  /** Format: date-time */
  created: string;
  read: boolean;
}

export interface SearchResult {
  projects: ProjectResource[];
  tasks: (TaskResource & { projectName: string })[];
}

export interface ReportRow {
  projectId: number;
  name: string;
  color: string;
  open: number;
  progress: number;
  closed: number;
  overdue: number;
}

export interface SupportInput {
  subject: string;
  message: string;
}

type None = Record<string, never>;

export interface RpcMethods {
  /** Requires nothing, returns the token for the header Authorization. */
  'sign.in': { params: { email: string; password: string }; result: SignInResult };
  'user.list': { params: None; result: UserResource[] };
  'user.updateProfile': { params: { input: ProfileInput }; result: UserResource };
  'project.list': { params: None; result: ProjectResource[] };
  'project.create': { params: { input: ProjectInput }; result: ProjectResource };
  'task.list': { params: { query: TaskQuery }; result: TaskPage };
  'task.read': { params: { id: number }; result: TaskDetail };
  'task.update': { params: { id: number; input: TaskSettings }; result: TaskDetail };
  /** Open tasks of the current user, for the menu. */
  'task.mine': { params: None; result: number };
  'comment.list': { params: { taskId: number }; result: CommentResource[] };
  'comment.create': { params: { taskId: number; text: string }; result: CommentResource };
  'comment.like': { params: { id: number }; result: CommentResource };
  'attachment.list': { params: { taskId: number }; result: AttachmentResource[] };
  /** One part of a file in base64, see fileChunks(). Returns the attachment with the last part. */
  'attachment.chunk': {
    params: { taskId: number; uploadId: string; name: string; type: string; index: number; total: number; data: string };
    result: AttachmentResource | null;
  };
  'history.list': { params: { taskId: number }; result: HistoryResource[] };
  'notification.list': { params: None; result: NotificationResource[] };
  'notification.markRead': { params: { ids: number[] }; result: null };
  'search.query': { params: { text: string }; result: SearchResult };
  'report.projects': { params: None; result: ReportRow[] };
  'support.contact': { params: { input: SupportInput }; result: null };
}

/** Typed client. Register an instance in the container: `new HelpdeskApi('/rpc')`. */
export class HelpdeskApi extends RpcClient<RpcMethods> {}
