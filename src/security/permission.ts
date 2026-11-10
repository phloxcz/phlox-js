/**
 * Access control list like Nette\Security\Permission: roles and resources form trees,
 * rules allow or deny privileges. `null` in a rule means all roles, all resources or all privileges.
 */

export abstract class Authorizator {
  /** Whether the role may do the privilege with the resource. `null` means all of them. */
  abstract isAllowed(role: string | null, resource: string | null, privilege: string | null): boolean;
}

export type Assertion = (acl: Permission, role: string | null, resource: string | null, privilege: string | null) => boolean;

type Names = string | string[] | null;

interface Rule {
  allow: boolean;
  assertion: Assertion | null;
}

const ALL = '\0';
const list = (names: Names): (string | null)[] => (names === null ? [null] : Array.isArray(names) ? names : [names]);

export class Permission extends Authorizator {
  private roles = new Map<string, string[]>();
  private resources = new Map<string, string | null>();
  /** role → resource → privilege → rule, ALL stands for null */
  private rules = new Map<string, Map<string, Map<string, Rule>>>();

  /** Adds a role. It inherits the rules of its parents, a parent added later wins in a conflict. */
  addRole(role: string, parents: string | string[] = []): this {
    if (this.roles.has(role)) throw new Error(`Role '${role}' already exists.`);
    const list = Array.isArray(parents) ? parents : [parents];
    for (const parent of list) this.checkRole(parent);
    this.roles.set(role, list);
    return this;
  }

  /** Adds a resource. It inherits the rules of its parent. */
  addResource(resource: string, parent: string | null = null): this {
    if (this.resources.has(resource)) throw new Error(`Resource '${resource}' already exists.`);
    if (parent !== null) this.checkResource(parent);
    this.resources.set(resource, parent);
    return this;
  }

  hasRole(role: string): boolean {
    return this.roles.has(role);
  }

  hasResource(resource: string): boolean {
    return this.resources.has(resource);
  }

  /** Allows privileges. An assertion makes the rule apply only when it returns true. */
  allow(roles: Names = null, resources: Names = null, privileges: Names = null, assertion: Assertion | null = null): this {
    return this.setRule(true, roles, resources, privileges, assertion);
  }

  deny(roles: Names = null, resources: Names = null, privileges: Names = null, assertion: Assertion | null = null): this {
    return this.setRule(false, roles, resources, privileges, assertion);
  }

  /**
   * Looks for the most specific rule: the resource before its parents, the role before its parents
   * and before "all roles", the privilege before "all privileges". With no rule the answer is no.
   */
  isAllowed(role: string | null = null, resource: string | null = null, privilege: string | null = null): boolean {
    if (role !== null) this.checkRole(role);
    if (resource !== null) this.checkResource(resource);

    for (let current = resource; ; current = this.resources.get(current)!) {
      const result = this.searchRoles(role, current, privilege);
      if (result !== null) return result;
      if (current === null) return false;
    }
  }

  private setRule(allow: boolean, roles: Names, resources: Names, privileges: Names, assertion: Assertion | null): this {
    for (const role of list(roles)) {
      if (role !== null) this.checkRole(role);
      for (const resource of list(resources)) {
        if (resource !== null) this.checkResource(resource);
        for (const privilege of list(privileges)) {
          const byResource = this.rules.get(role ?? ALL) ?? new Map<string, Map<string, Rule>>();
          this.rules.set(role ?? ALL, byResource);
          const byPrivilege = byResource.get(resource ?? ALL) ?? new Map<string, Rule>();
          byResource.set(resource ?? ALL, byPrivilege);
          byPrivilege.set(privilege ?? ALL, { allow, assertion });
        }
      }
    }
    return this;
  }

  /** The role, its ancestors depth first with later parents first, then "all roles". */
  private searchRoles(role: string | null, resource: string | null, privilege: string | null): boolean | null {
    const visited = new Set<string>();
    const stack = role === null ? [] : [role];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const result = this.ruleOf(current, resource, privilege);
      if (result !== null) return result;
      stack.push(...this.roles.get(current)!);
    }
    return this.ruleOf(null, resource, privilege, role);
  }

  private ruleOf(role: string | null, resource: string | null, privilege: string | null, asked = role): boolean | null {
    const privileges = this.rules.get(role ?? ALL)?.get(resource ?? ALL);
    if (!privileges) return null;
    const apply = (rule: Rule | undefined): boolean | null =>
      rule && (!rule.assertion || rule.assertion(this, asked, resource, privilege)) ? rule.allow : null;

    if (privilege !== null) return apply(privileges.get(privilege)) ?? apply(privileges.get(ALL));

    // All privileges are allowed only when none of them is denied here
    for (const [name, rule] of privileges) {
      if (name !== ALL && apply(rule) === false) return false;
    }
    return apply(privileges.get(ALL));
  }

  private checkRole(role: string): void {
    if (!this.roles.has(role)) throw new Error(`Role '${role}' does not exist.`);
  }

  private checkResource(resource: string): void {
    if (!this.resources.has(resource)) throw new Error(`Resource '${resource}' does not exist.`);
  }
}
