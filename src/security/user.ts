/** The logged-in user, like Nette\Security\User. Login goes through an Authenticator, permissions through an Authorizator. */

import { state } from '../reactive';
import { Authorizator } from './permission';

/** Who is logged in. `token` is what the browser proves itself with to the server, it is not shown anywhere. */
export class Identity {
  constructor(
    readonly id: string | number,
    readonly roles: string[] = [],
    readonly data: Record<string, unknown> = {},
    readonly token: string | null = null,
  ) {}
}

export abstract class Authenticator {
  /** Checks the credentials, usually by an RPC call, and returns the identity. Throws when they are wrong. */
  abstract authenticate(username: string, password: string): Promise<Identity>;
}

/** Where the identity is kept between page loads. */
export abstract class UserStorage {
  abstract load(): Identity | null;
  abstract save(identity: Identity | null): void;
}

/** Keeps the identity in sessionStorage: it survives a reload, but not closing the tab. */
export class BrowserUserStorage extends UserStorage {
  constructor(private key = 'phlox.identity', private storage: () => Storage | null = () => globalThis.sessionStorage ?? null) {
    super();
  }

  load(): Identity | null {
    try {
      const saved = JSON.parse(this.storage()?.getItem(this.key) ?? 'null');
      return saved ? new Identity(saved.id, saved.roles, saved.data, saved.token) : null;
    } catch {
      return null;
    }
  }

  save(identity: Identity | null): void {
    try {
      if (identity) this.storage()?.setItem(this.key, JSON.stringify(identity));
      else this.storage()?.removeItem(this.key);
    } catch {
      // A blocked storage only means the login is not remembered
    }
  }
}

class MissingAuthenticator extends Authenticator {
  async authenticate(): Promise<Identity> {
    throw new Error('No Authenticator in the container. Add your own: services.add(MyAuthenticator).');
  }
}

class MissingAuthorizator extends Authorizator {
  isAllowed(): boolean {
    throw new Error('No Authorizator in the container. Add a Permission or your own: services.add(acl).');
  }
}

/** Used by Application when the container has no service of that type. */
export const userDefaults = { BrowserUserStorage, MissingAuthenticator, MissingAuthorizator };

export class User {
  static $inject = () => [UserStorage, Authenticator, Authorizator];

  /** Role of a user who is not logged in. */
  guestRole = 'guest';
  /** Role of a logged-in user whose identity has no roles. */
  authenticatedRole = 'authenticated';

  private current = state<Identity | null>(null);

  constructor(private storage: UserStorage, private authenticator: Authenticator, private authorizator: Authorizator) {
    this.current.set(storage.load());
  }

  /** Logs in by credentials through the Authenticator, or directly by an identity. */
  async login(identity: Identity): Promise<void>;
  async login(username: string, password: string): Promise<void>;
  async login(user: Identity | string, password = ''): Promise<void> {
    const identity = user instanceof Identity ? user : await this.authenticator.authenticate(user, password);
    this.storage.save(identity);
    this.current.set(identity);
  }

  logout(): void {
    this.storage.save(null);
    this.current.set(null);
  }

  // The methods below read state, so in a template they update when somebody logs in or out

  isLoggedIn(): boolean {
    return this.current() !== null;
  }

  getIdentity(): Identity | null {
    return this.current();
  }

  getId(): string | number | null {
    return this.current()?.id ?? null;
  }

  /** The token for the server, null when nobody is logged in. */
  get token(): string | null {
    return this.current()?.token ?? null;
  }

  getRoles(): string[] {
    const identity = this.current();
    if (!identity) return [this.guestRole];
    return identity.roles.length > 0 ? identity.roles : [this.authenticatedRole];
  }

  isInRole(role: string): boolean {
    return this.getRoles().includes(role);
  }

  /** Whether any of the roles of the user may do the privilege with the resource. */
  isAllowed(resource: string | null = null, privilege: string | null = null): boolean {
    return this.getRoles().some(role => this.authorizator.isAllowed(role, resource, privilege));
  }
}
