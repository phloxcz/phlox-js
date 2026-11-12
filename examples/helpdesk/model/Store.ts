import { batch, state } from 'phlox-js';
import { HelpdeskApi } from '../api';
import type { ProjectResource, UserResource } from '../api';

/**
 * What more screens show at once: users, projects with their counts and the number of my open tasks.
 * After a change of a task, `changed()` loads them again and lists that read `version` load themselves again.
 */
export class Store {
  readonly users = state<UserResource[]>([]);
  readonly projects = state<ProjectResource[]>([]);
  /** Open tasks of the logged-in user, for the menu. */
  readonly mine = state(0);
  /** Increased after every change of tasks. */
  readonly version = state(0);

  constructor(private api: HelpdeskApi) {}

  /** Three calls at once go to the server as one batch request. */
  async load(): Promise<void> {
    const [users, projects, mine] = await Promise.all([
      this.api.call('user.list'),
      this.api.call('project.list'),
      this.api.call('task.mine'),
    ]);
    batch(() => {
      this.users.set(users);
      this.projects.set(projects);
      this.mine.set(mine);
    });
  }

  async changed(): Promise<void> {
    this.version.update(version => version + 1);
    await this.load();
  }

  user(id: number | null): UserResource | undefined {
    return this.users().find(user => user.id === id);
  }

  project(id: number | undefined): ProjectResource | undefined {
    return this.projects().find(project => project.id === id);
  }
}
