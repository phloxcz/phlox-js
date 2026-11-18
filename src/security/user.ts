/** The logged-in user, like Nette\Security\User. Login goes through an Authenticator, permissions through an Authorizator. */

import { state } from '../reactive/reactive';
import { Authorizator } from './permission';

/** Who is logged in. `token` is what the browser proves itself with to the server, it is not shown anywhere. */
export class Identity {
  public constructor(
    public readonly id: string | number,
    public readonly roles: string[] = [],
    public readonly data: Record<string, unknown> = {},
    public readonly token: string | null = null,
  ) {}
}

export abstract class Authenticator {
  /** Checks the credentials, usually by an RPC call, and returns the identity. Throws when they are wrong. */
  public abstract authenticate(username: string, password: string): Promise<Identity>;
}

/** Where the identity is kept between page loads. */
export abstract class UserStorage {
  public abstract load(): Identity | null;
  public abstract save(identity: Identity | null): void;
}

/** Keeps the identity in sessionStorage: it survives a reload, but not closing the tab. */
export class BrowserUserStorage extends UserStorage {
  public constructor(private key = 'phlox.identity', private storage: () => Storage | null = () => globalThis.sessionStorage ?? null) {
    super();
  }

  public load(): Identity | null {
    try {
      const saved = JSON.parse(this.storage()?.getItem(this.key) ?? 'null');
      return saved ? new Identity(saved.id, saved.roles, saved.data, saved.token) : null;
    } catch {
      return null;
    }
  }

  public save(identity: Identity | null): void {
    try {
      if (identity) this.storage()?.setItem(this.key, JSON.stringify(identity));
      else this.storage()?.removeItem(this.key);
    } catch {
      // A blocked storage only means the login is not remembered
    }
  }
}

class MissingAuthenticator extends Authenticator {
  public async authenticate(): Promise<Identity> {
    throw new Error('No Authenticator in the container. Add your own: services.add(MyAuthenticator).');
  }
}

class MissingAuthorizator extends Authorizator {
  public isAllowed(): boolean {
    throw new Error('No Authorizator in the container. Add a Permission or your own: services.add(acl).');
  }
}

/** Used by Application when the container has no service of that type. */
export const userDefaults = { BrowserUserStorage, MissingAuthenticator, MissingAuthorizator };

export class User {
  public static $inject = () => [UserStorage, Authenticator, Authorizator];

  /** Role of a user who is not logged in. */
  public guestRole = 'guest';
  /** Role of a logged-in user whose identity has no roles. */
  public authenticatedRole = 'authenticated';

  private current = state<Identity | null>(null);

  public constructor(private storage: UserStorage, private authenticator: Authenticator, private authorizator: Authorizator) {
    this.current.set(storage.load());
  }

  /** Logs in by credentials through the Authenticator, or directly by an identity. */
  public async login(identity: Identity): Promise<void>;
  public async login(username: string, password: string): Promise<void>;
  public async login(user: Identity | string, password = ''): Promise<void> {
    const identity = user instanceof Identity ? user : await this.authenticator.authenticate(user, password);
    this.storage.save(identity);
    this.current.set(identity);
  }

  public logout(): void {
    this.storage.save(null);
    this.current.set(null);
  }

  // The methods below read state, so in a template they update when somebody logs in or out

  public isLoggedIn(): boolean {
    return this.current() !== null;
  }

  public getIdentity(): Identity | null {
    return this.current();
  }

  public getId(): string | number | null {
    return this.current()?.id ?? null;
  }

  /** The token for the server, null when nobody is logged in. */
  public get token(): string | null {
    return this.current()?.token ?? null;
  }

  public getRoles(): string[] {
    const identity = this.current();
    if (!identity) return [this.guestRole];
    return identity.roles.length > 0 ? identity.roles : [this.authenticatedRole];
  }

  public isInRole(role: string): boolean {
    return this.getRoles().includes(role);
  }

  /** Whether any of the roles of the user may do the privilege with the resource. */
  public isAllowed(resource: string | null = null, privilege: string | null = null): boolean {
    return this.getRoles().some(role => this.authorizator.isAllowed(role, resource, privilege));
  }
}
