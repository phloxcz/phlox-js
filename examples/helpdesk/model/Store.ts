import { Application } from 'phlox-js';
import type { Resource } from 'phlox-js';
import { HelpdeskApi } from '../api';
import type { ProjectResource, UserResource } from '../api';

/**
 * What more screens show at once: users, projects with their counts and the number of my open tasks.
 * They are resources of the application with tags: after app.invalidate('tasks') or ('projects')
 * they load again by themselves, together with every list on the screen that has the same tag.
 */
export class Store {
  private loaded: { users: Resource<UserResource[]>; projects: Resource<ProjectResource[]>; mine: Resource<number> } | null = null;

  constructor(private api: HelpdeskApi, private app: Application) {}

  /** Starts loading after sign-in (before it the server would refuse) and waits for the first data. */
  async start(): Promise<void> {
    // Three calls at once go to the server as one batch request
    this.loaded ??= {
      users: this.app.resource(() => this.api.call('user.list'), { tags: ['users'] }),
      projects: this.app.resource(() => this.api.call('project.list'), { tags: ['projects'] }),
      mine: this.app.resource(() => this.api.call('task.mine'), { tags: ['tasks'] }),
    };
    await Promise.all([this.loaded.users.ready(), this.loaded.projects.ready(), this.loaded.mine.ready()]);
  }

  users(): UserResource[] {
    return this.loaded?.users() ?? [];
  }

  projects(): ProjectResource[] {
    return this.loaded?.projects() ?? [];
  }

  /** Open tasks of the logged-in user, for the menu. */
  mine(): number {
    return this.loaded?.mine() ?? 0;
  }

  user(id: number | null): UserResource | undefined {
    return this.users().find(user => user.id === id);
  }

  project(id: number | undefined): ProjectResource | undefined {
    return this.projects().find(project => project.id === id);
  }
}
