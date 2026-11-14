import { state } from "../reactive/reactive.js";
import { Authorizator } from "./permission.js";
// src/security/user.ts
/** The logged-in user, like Nette\Security\User. Login goes through an Authenticator, permissions through an Authorizator. */
/** Who is logged in. `token` is what the browser proves itself with to the server, it is not shown anywhere. */
var Identity = class {
	id;
	roles;
	data;
	token;
	constructor(id, roles = [], data = {}, token = null) {
		this.id = id;
		this.roles = roles;
		this.data = data;
		this.token = token;
	}
};
var Authenticator = class {};
/** Where the identity is kept between page loads. */
var UserStorage = class {};
/** Keeps the identity in sessionStorage: it survives a reload, but not closing the tab. */
var BrowserUserStorage = class extends UserStorage {
	key;
	storage;
	constructor(key = "phlox.identity", storage = () => globalThis.sessionStorage ?? null) {
		super();
		this.key = key;
		this.storage = storage;
	}
	load() {
		try {
			const saved = JSON.parse(this.storage()?.getItem(this.key) ?? "null");
			return saved ? new Identity(saved.id, saved.roles, saved.data, saved.token) : null;
		} catch {
			return null;
		}
	}
	save(identity) {
		try {
			if (identity) this.storage()?.setItem(this.key, JSON.stringify(identity));
			else this.storage()?.removeItem(this.key);
		} catch {}
	}
};
var MissingAuthenticator = class extends Authenticator {
	async authenticate() {
		throw new Error("No Authenticator in the container. Add your own: services.add(MyAuthenticator).");
	}
};
var MissingAuthorizator = class extends Authorizator {
	isAllowed() {
		throw new Error("No Authorizator in the container. Add a Permission or your own: services.add(acl).");
	}
};
/** Used by Application when the container has no service of that type. */
var userDefaults = {
	BrowserUserStorage,
	MissingAuthenticator,
	MissingAuthorizator
};
var User = class {
	storage;
	authenticator;
	authorizator;
	static $inject = () => [
		UserStorage,
		Authenticator,
		Authorizator
	];
	/** Role of a user who is not logged in. */
	guestRole = "guest";
	/** Role of a logged-in user whose identity has no roles. */
	authenticatedRole = "authenticated";
	current = state(null);
	constructor(storage, authenticator, authorizator) {
		this.storage = storage;
		this.authenticator = authenticator;
		this.authorizator = authorizator;
		this.current.set(storage.load());
	}
	async login(user, password = "") {
		const identity = user instanceof Identity ? user : await this.authenticator.authenticate(user, password);
		this.storage.save(identity);
		this.current.set(identity);
	}
	logout() {
		this.storage.save(null);
		this.current.set(null);
	}
	isLoggedIn() {
		return this.current() !== null;
	}
	getIdentity() {
		return this.current();
	}
	getId() {
		return this.current()?.id ?? null;
	}
	/** The token for the server, null when nobody is logged in. */
	get token() {
		return this.current()?.token ?? null;
	}
	getRoles() {
		const identity = this.current();
		if (!identity) return [this.guestRole];
		return identity.roles.length > 0 ? identity.roles : [this.authenticatedRole];
	}
	isInRole(role) {
		return this.getRoles().includes(role);
	}
	/** Whether any of the roles of the user may do the privilege with the resource. */
	isAllowed(resource = null, privilege = null) {
		return this.getRoles().some((role) => this.authorizator.isAllowed(role, resource, privilege));
	}
};
export { Authenticator, BrowserUserStorage, Identity, User, UserStorage, userDefaults };
