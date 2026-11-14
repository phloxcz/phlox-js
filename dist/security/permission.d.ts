/**
 * Access control list like Nette\Security\Permission: roles and resources form trees,
 * rules allow or deny privileges. `null` in a rule means all roles, all resources or all privileges.
 */
export declare abstract class Authorizator {
    /** Whether the role may do the privilege with the resource. `null` means all of them. */
    abstract isAllowed(role: string | null, resource: string | null, privilege: string | null): boolean;
}
export type Assertion = (acl: Permission, role: string | null, resource: string | null, privilege: string | null) => boolean;
type Names = string | string[] | null;
export declare class Permission extends Authorizator {
    private roles;
    private resources;
    /** role → resource → privilege → rule, ALL stands for null */
    private rules;
    /** Adds a role. It inherits the rules of its parents, a parent added later wins in a conflict. */
    addRole(role: string, parents?: string | string[]): this;
    /** Adds a resource. It inherits the rules of its parent. */
    addResource(resource: string, parent?: string | null): this;
    hasRole(role: string): boolean;
    hasResource(resource: string): boolean;
    /** Allows privileges. An assertion makes the rule apply only when it returns true. */
    allow(roles?: Names, resources?: Names, privileges?: Names, assertion?: Assertion | null): this;
    deny(roles?: Names, resources?: Names, privileges?: Names, assertion?: Assertion | null): this;
    /**
     * Looks for the most specific rule: the resource before its parents, the role before its parents
     * and before "all roles", the privilege before "all privileges". With no rule the answer is no.
     */
    isAllowed(role?: string | null, resource?: string | null, privilege?: string | null): boolean;
    private setRule;
    /** The role, its ancestors depth first with later parents first, then "all roles". */
    private searchRoles;
    private ruleOf;
    private checkRole;
    private checkResource;
}
export {};
