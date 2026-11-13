// Filtering and ordering of tasks, shared by the mock server and the offline layer: offline,
// a list with any filter is computed from the kept tasks in the same way the server does it.
import type { Priority, TaskPage, TaskQuery, TaskResource } from '../api.ts';

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export const taskItem = ({ id, projectId, title, status, priority, assigneeId, due }: TaskResource): TaskResource =>
  ({ id, projectId, title, status, priority, assigneeId, due });

/** A page of tasks for the query, with the counts of the tabs (those are without the filter of status). */
export function queryTasks(all: readonly TaskResource[], query: TaskQuery): TaskPage {
  let tasks = all.filter(task => (query.projectId === undefined || task.projectId === query.projectId)
    && (query.assigneeId === undefined || task.assigneeId === query.assigneeId)
    && (!query.priority?.length || query.priority.includes(task.priority)));
  const counts = {
    all: tasks.length,
    open: tasks.filter(task => task.status === 'open').length,
    progress: tasks.filter(task => task.status === 'progress').length,
    closed: tasks.filter(task => task.status === 'closed').length,
  };
  if (query.status) tasks = tasks.filter(task => task.status === query.status);
  const byDue = (a: TaskResource, b: TaskResource) => (a.due ?? '9999').localeCompare(b.due ?? '9999');
  const sorted = [...tasks].sort(query.sort === 'priority'
    ? (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || byDue(a, b)
    : (a, b) => byDue(a, b) || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  return { data: sorted.map(taskItem), counts };
}
