/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { generateRpcTypes } from '../src/net/openrpc';
import type { OpenRpcDocument } from '../src/net/openrpc';

// Vitest runs from the root of the repository
const fixture = (name: string) => readFileSync(`tests/fixtures/${name}`, 'utf8');

describe('generateRpcTypes', () => {
  test('the committed types of phlox-api-sample are what the generator writes', () => {
    // When this fails after a change of the generator, run:
    // node src/net/rpc-types.ts tests/fixtures/openrpc-sample.json tests/fixtures/sample-rpc.ts --class SampleApi --import ../../src/net/index
    const document = JSON.parse(fixture('openrpc-sample.json')) as OpenRpcDocument;
    const generated = generateRpcTypes(document, { className: 'SampleApi', importFrom: '../../src/net/index' });
    expect(generated).toBe(fixture('sample-rpc.ts').replaceAll('\r\n', '\n'));
  });

  test('maps JSON Schema to TypeScript', () => {
    const output = generateRpcTypes({
      methods: [{
        name: 'user.save',
        summary: 'Saves a user.',
        params: [{ name: 'input', required: true, schema: { $ref: '#/components/schemas/CreateUser' } }],
        result: { schema: { type: 'null' } },
        'x-authorize': true,
        'x-roles': [['admin', 'editor'], ['publisher']],
      }, {
        name: 'ping',
        params: [],
        result: { schema: { type: 'string' } },
      }],
      components: {
        schemas: {
          CreateUser: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string' },
              age: { type: ['integer', 'null'] },
              role: { type: 'string', enum: ['admin', 'user'] },
              tags: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'integer' }] } },
              meta: { type: 'object', additionalProperties: { type: 'boolean' } },
              'created-at': { type: 'string', format: 'date-time' },
              base: { allOf: [{ $ref: '#/components/schemas/Role' }] },
            },
          },
          Role: { type: 'string', enum: ['admin', 'user'], description: 'Role of a */ user' },
        },
      },
    });

    expect(output).toContain('export interface CreateUser {');
    expect(output).toContain('  name: string;');
    expect(output).toContain('  age?: number | null;');
    expect(output).toContain('  role?: "admin" | "user";');
    expect(output).toContain('  tags?: (string | number)[];');
    expect(output).toContain('  meta?: Record<string, boolean>;');
    expect(output).toContain('  "created-at"?: string;');
    expect(output).toContain('Format: date-time.');
    expect(output).toContain('  base?: Role;');
    expect(output).toContain('/** Role of a *\\/ user */\nexport type Role = "admin" | "user";');
    expect(output).toContain('      input: CreateUser;');
    expect(output).toContain('Requires login and roles: admin or editor, and publisher.');
    expect(output).toContain('  "ping": {\n    params: Record<string, never>;\n    result: string;');
    expect(output).toContain('export class RpcApi extends RpcClient<RpcMethods> {}');
    expect(output).toContain('import { RpcClient } from "phlox-js/net";');
  });
});
