/**
 * Generates TypeScript types from an OpenRPC document, as phloxcz/rpc-api publishes it at /rpc/openrpc.json.
 * It has no imports, so the command line script can run it in Node directly.
 */

interface Schema {
  $ref?: string;
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  anyOf?: Schema[];
  oneOf?: Schema[];
  allOf?: Schema[];
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean | Schema;
  description?: string;
  format?: string;
}

interface Method {
  name: string;
  summary?: string;
  description?: string;
  deprecated?: boolean;
  params?: { name: string; required?: boolean; schema?: Schema; description?: string }[];
  result?: { schema?: Schema; description?: string };
  'x-authorize'?: boolean;
  'x-roles'?: string[][];
}

export interface OpenRpcDocument {
  info?: { title?: string; version?: string };
  methods: Method[];
  components?: { schemas?: Record<string, Schema> };
}

export interface GenerateOptions {
  /** Name of the generated client class, `RpcApi` by default. */
  className?: string;
  /** Where the client is imported from, `phlox-js/net` by default. */
  importFrom?: string;
}

const typeName = (name: string): string => name.replace(/\W/g, '_').replace(/^(\d)/, '_$1');

const propertyName = (name: string): string => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name));

function comment(lines: (string | undefined | false)[], indent: string): string {
  const text = lines.filter((line): line is string => Boolean(line)).join('\n\n').replaceAll('*/', '*\\/');
  if (!text) return '';
  if (!text.includes('\n')) return `${indent}/** ${text} */\n`;
  return `${indent}/**\n${text.split('\n').map(line => `${indent} *${line ? ` ${line}` : ''}`).join('\n')}\n${indent} */\n`;
}

/** A union or intersection needs brackets before `[]`, a plain object does not. */
const parenthesize = (type: string): string =>
  (/^\{\n[\s\S]*\}$/.test(type) || !/[|&]/.test(type) ? type : `(${type})`);

function union(types: string[]): string {
  const unique = [...new Set(types)];
  return unique.includes('unknown') ? 'unknown' : unique.join(' | ');
}

/** One schema as a TypeScript type. */
function toType(schema: Schema | undefined, indent: string): string {
  if (!schema || typeof schema !== 'object') return 'unknown';
  if (schema.$ref) return typeName(schema.$ref.split('/').pop()!);
  if (schema.allOf) return schema.allOf.map(part => parenthesize(toType(part, indent))).join(' & ');
  if (schema.anyOf || schema.oneOf) return union((schema.anyOf ?? schema.oneOf)!.map(part => toType(part, indent)));
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (schema.enum) return union(schema.enum.map(value => JSON.stringify(value)));
  if (Array.isArray(schema.type)) return union(schema.type.map(type => toType({ ...schema, type }, indent)));

  switch (schema.type) {
    case 'string': return 'string';
    case 'integer':
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'null': return 'null';
    case 'array': return `${parenthesize(toType(schema.items, indent))}[]`;
    case 'object': return objectType(schema, indent);
    default: return 'unknown';
  }
}

function objectType(schema: Schema, indent: string): string {
  const extra = schema.additionalProperties;
  const record = typeof extra === 'object' ? `Record<string, ${toType(extra, indent)}>` : 'Record<string, unknown>';
  const properties = Object.entries(schema.properties ?? {});
  if (properties.length === 0) return extra === false ? 'Record<string, never>' : record;

  const inner = `${indent}  `;
  const required = new Set(schema.required ?? []);
  const members = properties.map(([name, property]) => {
    const note = property.format && property.format !== 'binary' ? `Format: ${property.format}.` : undefined;
    const optional = required.has(name) ? '' : '?';
    return `${comment([property.description, note], inner)}${inner}${propertyName(name)}${optional}: ${toType(property, inner)};`;
  });
  const object = `{\n${members.join('\n')}\n${indent}}`;
  return typeof extra === 'object' ? `${object} & ${record}` : object;
}

function authorization(method: Method): string | undefined {
  if (!method['x-authorize']) return undefined;
  const roles = method['x-roles'] ?? [];
  if (roles.length === 0) return 'Requires login.';
  return `Requires login and roles: ${roles.map(group => group.join(' or ')).join(', and ')}.`;
}

/** Returns the content of a TypeScript file with the types of the document and a typed client class. */
export function generateRpcTypes(document: OpenRpcDocument, options: GenerateOptions = {}): string {
  const className = options.className ?? 'RpcApi';
  const source = [document.info?.title, document.info?.version].filter(Boolean).join(' ');
  const out: string[] = [
    `// Generated from the OpenRPC document${source ? ` of ${source}` : ''}. Do not edit, generate it again.`,
    `import { RpcClient } from ${JSON.stringify(options.importFrom ?? 'phlox-js/net')};`,
    '',
  ];

  for (const [name, schema] of Object.entries(document.components?.schemas ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    const type = toType(schema, '');
    out.push(comment([schema.description], '') + (type.startsWith('{\n')
      ? `export interface ${typeName(name)} ${type}`
      : `export type ${typeName(name)} = ${type};`), '');
  }

  out.push('export interface RpcMethods {');
  for (const method of [...document.methods].sort((a, b) => a.name.localeCompare(b.name))) {
    const params = method.params ?? [];
    const paramsType = params.length === 0 ? 'Record<string, never>' : `{\n${params.map(param =>
      `${comment([param.description], '      ')}      ${propertyName(param.name)}${param.required ? '' : '?'}: ${toType(param.schema, '      ')};`,
    ).join('\n')}\n    }`;
    out.push(
      comment([method.summary, method.description, authorization(method), method.deprecated && '@deprecated'], '  ')
      + `  ${JSON.stringify(method.name)}: {\n    params: ${paramsType};\n`
      + `${comment([method.result?.description], '    ')}    result: ${toType(method.result?.schema, '    ')};\n  };`,
    );
  }
  out.push('}', '', `/** Typed client. Register an instance in the container: \`new ${className}('/rpc')\`. */`,
    `export class ${className} extends RpcClient<RpcMethods> {}`, '');
  return out.join('\n');
}
