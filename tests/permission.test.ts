import { describe, expect, test } from 'vitest';
import { Permission } from '../src/security/index';

/** Roles and resources as in the example of the Nette documentation. */
function acl() {
  return new Permission()
    .addRole('guest')
    .addRole('registered', 'guest')
    .addRole('administrator')
    .addResource('article')
    .addResource('comment')
    .addResource('poll')
    .allow('guest', ['article', 'comment', 'poll'], 'view')
    .allow('registered', ['comment', 'poll'], 'add')
    .allow('administrator', null, ['view', 'edit', 'add']);
}

describe('Permission', () => {
  test('rules of the Nette documentation example', () => {
    const permission = acl();
    expect(permission.isAllowed('guest', 'article', 'view')).toBe(true);
    expect(permission.isAllowed('guest', 'poll', 'add')).toBe(false);
    expect(permission.isAllowed('registered', 'article', 'view')).toBe(true);
    expect(permission.isAllowed('registered', 'comment', 'add')).toBe(true);
    expect(permission.isAllowed('registered', 'article', 'edit')).toBe(false);
    expect(permission.isAllowed('administrator', 'poll', 'edit')).toBe(true);
    expect(permission.isAllowed('administrator', 'poll', 'delete')).toBe(false);
  });

  test('without a rule the answer is no', () => {
    expect(new Permission().addRole('a').addResource('r').isAllowed('a', 'r', 'view')).toBe(false);
  });

  test('a more specific rule wins: role over parent, privilege over all privileges, resource over parent', () => {
    const permission = new Permission()
      .addRole('guest')
      .addRole('member', 'guest')
      .addResource('document')
      .addResource('report', 'document')
      .allow('guest', 'document')
      .deny('member', 'document', 'delete')
      .deny('guest', 'report', 'view');

    expect(permission.isAllowed('guest', 'document', 'delete')).toBe(true);
    expect(permission.isAllowed('member', 'document', 'delete')).toBe(false);
    expect(permission.isAllowed('member', 'document', 'edit')).toBe(true);
    expect(permission.isAllowed('member', 'report', 'edit')).toBe(true);
    expect(permission.isAllowed('member', 'report', 'view')).toBe(false);
  });

  test('a parent added later wins over an earlier one', () => {
    const permission = new Permission()
      .addRole('reader')
      .addRole('blocked')
      .addRole('both', ['reader', 'blocked'])
      .addRole('reversed', ['blocked', 'reader'])
      .addResource('page')
      .allow('reader', 'page', 'view')
      .deny('blocked', 'page', 'view');

    expect(permission.isAllowed('both', 'page', 'view')).toBe(false);
    expect(permission.isAllowed('reversed', 'page', 'view')).toBe(true);
  });

  test('null means all roles, all resources and all privileges', () => {
    const permission = new Permission().addRole('a').addRole('b').addResource('r').allow(null, 'r', 'view').allow('b');
    expect(permission.isAllowed('a', 'r', 'view')).toBe(true);
    expect(permission.isAllowed('a', 'r', 'edit')).toBe(false);
    expect(permission.isAllowed('b', 'r', 'anything')).toBe(true);
    expect(permission.isAllowed('b')).toBe(true);
  });

  test('all privileges are allowed only when none of them is denied', () => {
    const permission = new Permission().addRole('editor').addResource('article').allow('editor', 'article').deny('editor', 'article', 'delete');
    expect(permission.isAllowed('editor', 'article', 'edit')).toBe(true);
    expect(permission.isAllowed('editor', 'article', null)).toBe(false);
  });

  test('an assertion decides whether the rule applies', () => {
    let owner = true;
    const permission = new Permission()
      .addRole('author')
      .addResource('article')
      .allow('author', 'article', 'edit', (_acl, role, resource, privilege) => {
        expect([role, resource, privilege]).toEqual(['author', 'article', 'edit']);
        return owner;
      });
    expect(permission.isAllowed('author', 'article', 'edit')).toBe(true);
    owner = false;
    expect(permission.isAllowed('author', 'article', 'edit')).toBe(false);
  });

  test('unknown roles and resources are errors, as in Nette', () => {
    const permission = acl();
    expect(() => permission.isAllowed('nobody', 'article', 'view')).toThrow("Role 'nobody' does not exist");
    expect(() => permission.isAllowed('guest', 'nothing', 'view')).toThrow("Resource 'nothing' does not exist");
    expect(() => permission.addRole('guest')).toThrow('already exists');
    expect(() => permission.addRole('x', 'missing')).toThrow("Role 'missing' does not exist");
    expect(() => permission.allow('guest', 'missing')).toThrow("Resource 'missing' does not exist");
    expect(permission.hasRole('guest')).toBe(true);
    expect(permission.hasResource('poll')).toBe(true);
  });
});
