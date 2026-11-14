/** The logged-in user, like Nette\Security\User. Login goes through an Authenticator, permissions through an Authorizator. */
import { Authorizator } from './permission';
/** Who is logged in. `token` is what the browser proves itself with to the server, it is not shown anywhere. */
export declare class Identity {
    readonly id: string | number;
    readonly roles: string[];
    readonly data: Record<string, unknown>;
    readonly token: string | null;
    constructor(id: string | number, roles?: string[], data?: Record<string, unknown>, token?: string | null);
}
export declare abstract class Authenticator {
    /** Checks the credentials, usually by an RPC call, and returns the identity. Throws when they are wrong. */
    abstract authenticate(username: string, password: string): Promise<Identity>;
}
/** Where the identity is kept between page loads. */
export declare abstract class UserStorage {
    abstract load(): Identity | null;
    abstract save(identity: Identity | null): void;
}
/** Keeps the identity in sessionStorage: it survives a reload, but not closing the tab. */
export declare class BrowserUserStorage extends UserStorage {
    private key;
    private storage;
    constructor(key?: string, storage?: () => Storage | null);
    load(): Identity | null;
    save(identity: Identity | null): void;
}
declare class MissingAuthenticator extends Authenticator {
    authenticate(): Promise<Identity>;
}
declare class MissingAuthorizator extends Authorizator {
    isAllowed(): boolean;
}
/** Used by Application when the container has no service of that type. */
export declare const userDefaults: {
    BrowserUserStorage: typeof BrowserUserStorage;
    MissingAuthenticator: typeof MissingAuthenticator;
    MissingAuthorizator: typeof MissingAuthorizator;
};
export declare class User {
    private storage;
    private authenticator;
    private authorizator;
    static $inject: () => (typeof Authorizator | typeof Authenticator | typeof UserStorage)[];
    /** Role of a user who is not logged in. */
    guestRole: string;
    /** Role of a logged-in user whose identity has no roles. */
    authenticatedRole: string;
    private current;
    constructor(storage: UserStorage, authenticator: Authenticator, authorizator: Authorizator);
    /** Logs in by credentials through the Authenticator, or directly by an identity. */
    login(identity: Identity): Promise<void>;
    login(username: string, password: string): Promise<void>;
    logout(): void;
    isLoggedIn(): boolean;
    getIdentity(): Identity | null;
    getId(): string | number | null;
    /** The token for the server, null when nobody is logged in. */
    get token(): string | null;
    getRoles(): string[];
    isInRole(role: string): boolean;
    /** Whether any of the roles of the user may do the privilege with the resource. */
    isAllowed(resource?: string | null, privilege?: string | null): boolean;
}
export {};
