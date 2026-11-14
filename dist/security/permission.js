// src/security/permission.ts
/**
* Access control list like Nette\Security\Permission: roles and resources form trees,
* rules allow or deny privileges. `null` in a rule means all roles, all resources or all privileges.
*/
var Authorizator = class {};
var ALL = "\0";
var list = (names) => names === null ? [null] : Array.isArray(names) ? names : [names];
var Permission = class extends Authorizator {
	roles = /* @__PURE__ */ new Map();
	resources = /* @__PURE__ */ new Map();
	/** role → resource → privilege → rule, ALL stands for null */
	rules = /* @__PURE__ */ new Map();
	/** Adds a role. It inherits the rules of its parents, a parent added later wins in a conflict. */
	addRole(role, parents = []) {
		if (this.roles.has(role)) throw new Error(`Role '${role}' already exists.`);
		const list = Array.isArray(parents) ? parents : [parents];
		for (const parent of list) this.checkRole(parent);
		this.roles.set(role, list);
		return this;
	}
	/** Adds a resource. It inherits the rules of its parent. */
	addResource(resource, parent = null) {
		if (this.resources.has(resource)) throw new Error(`Resource '${resource}' already exists.`);
		if (parent !== null) this.checkResource(parent);
		this.resources.set(resource, parent);
		return this;
	}
	hasRole(role) {
		return this.roles.has(role);
	}
	hasResource(resource) {
		return this.resources.has(resource);
	}
	/** Allows privileges. An assertion makes the rule apply only when it returns true. */
	allow(roles = null, resources = null, privileges = null, assertion = null) {
		return this.setRule(true, roles, resources, privileges, assertion);
	}
	deny(roles = null, resources = null, privileges = null, assertion = null) {
		return this.setRule(false, roles, resources, privileges, assertion);
	}
	/**
	* Looks for the most specific rule: the resource before its parents, the role before its parents
	* and before "all roles", the privilege before "all privileges". With no rule the answer is no.
	*/
	isAllowed(role = null, resource = null, privilege = null) {
		if (role !== null) this.checkRole(role);
		if (resource !== null) this.checkResource(resource);
		for (let current = resource;; current = this.resources.get(current)) {
			const result = this.searchRoles(role, current, privilege);
			if (result !== null) return result;
			if (current === null) return false;
		}
	}
	setRule(allow, roles, resources, privileges, assertion) {
		for (const role of list(roles)) {
			if (role !== null) this.checkRole(role);
			for (const resource of list(resources)) {
				if (resource !== null) this.checkResource(resource);
				for (const privilege of list(privileges)) {
					const byResource = this.rules.get(role ?? ALL) ?? /* @__PURE__ */ new Map();
					this.rules.set(role ?? ALL, byResource);
					const byPrivilege = byResource.get(resource ?? ALL) ?? /* @__PURE__ */ new Map();
					byResource.set(resource ?? ALL, byPrivilege);
					byPrivilege.set(privilege ?? ALL, {
						allow,
						assertion
					});
				}
			}
		}
		return this;
	}
	/** The role, its ancestors depth first with later parents first, then "all roles". */
	searchRoles(role, resource, privilege) {
		const visited = /* @__PURE__ */ new Set();
		const stack = role === null ? [] : [role];
		while (stack.length > 0) {
			const current = stack.pop();
			if (visited.has(current)) continue;
			visited.add(current);
			const result = this.ruleOf(current, resource, privilege);
			if (result !== null) return result;
			stack.push(...this.roles.get(current));
		}
		return this.ruleOf(null, resource, privilege, role);
	}
	ruleOf(role, resource, privilege, asked = role) {
		const privileges = this.rules.get(role ?? ALL)?.get(resource ?? ALL);
		if (!privileges) return null;
		const apply = (rule) => rule && (!rule.assertion || rule.assertion(this, asked, resource, privilege)) ? rule.allow : null;
		if (privilege !== null) return apply(privileges.get(privilege)) ?? apply(privileges.get(ALL));
		for (const [name, rule] of privileges) if (name !== ALL && apply(rule) === false) return false;
		return apply(privileges.get(ALL));
	}
	checkRole(role) {
		if (!this.roles.has(role)) throw new Error(`Role '${role}' does not exist.`);
	}
	checkResource(resource) {
		if (!this.resources.has(resource)) throw new Error(`Resource '${resource}' does not exist.`);
	}
};
export { Authorizator, Permission };
