const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);
const QUERY_ID = /(?:^id$|(?:id|key|ref)$|tenant|account|organisation|organization|workspace|project|owner|user)/i;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cell(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replace(/\s+/g, ' ')
    .trim();
}

function csvCell(value) {
  let text = String(value ?? '').replace(/[\r\n]+/g, ' ');
  // A reviewed spec may contain attacker-controlled summaries or parameter names.
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function securityFor(operation, document) {
  const requirement = Object.hasOwn(operation, 'security')
    ? operation.security
    : document.security;

  if (requirement === undefined) return { label: 'Unspecified in spec', declared: false };
  if (!Array.isArray(requirement)) throw new Error('security must be an array');
  if (requirement.length === 0) return { label: 'No scheme required in spec', declared: false };

  const alternatives = requirement.map((choice) => {
    if (!isObject(choice)) throw new Error('security alternatives must be objects');
    const schemes = Object.entries(choice);
    if (schemes.length === 0) return 'Anonymous allowed';
    return schemes.map(([name, scopes]) => {
      if (!Array.isArray(scopes)) throw new Error(`security scopes for ${name} must be an array`);
      return scopes.length ? `${name} [${scopes.join(', ')}]` : name;
    }).join(' + ');
  });

  return {
    label: alternatives.join(' OR '),
    declared: !alternatives.includes('Anonymous allowed'),
  };
}

function referencesFor(path, pathItem, operation) {
  const names = [...path.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]);
  const parameters = [...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
    ...(Array.isArray(operation.parameters) ? operation.parameters : [])];
  for (const parameter of parameters) {
    if (!isObject(parameter) || parameter.in !== 'query' || typeof parameter.name !== 'string') continue;
    if (QUERY_ID.test(parameter.name)) names.push(`query:${parameter.name}`);
  }
  return [...new Set(names)];
}

export function analyseOpenApi(document) {
  if (!isObject(document) || !/^3\.[012](?:\.|$)/.test(document.openapi ?? '')) {
    throw new Error('Expected an OpenAPI 3.0, 3.1 or 3.2 JSON document');
  }
  if (!isObject(document.paths)) throw new Error('OpenAPI paths must be an object');

  const operations = [];
  const checks = [];

  for (const [path, pathItem] of Object.entries(document.paths)) {
    if (!path.startsWith('/') || !isObject(pathItem)) continue;
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!METHODS.has(method.toLowerCase()) || !isObject(operation)) continue;
      const security = securityFor(operation, document);
      const references = referencesFor(path, pathItem, operation);
      const endpoint = `${method.toUpperCase()} ${path}`;
      operations.push({ endpoint, security: security.label, references });

      checks.push({ endpoint, security: security.label, references, case: 'Authentication',
        question: security.declared ? 'Does a request without valid credentials fail?' : 'Is public access intended and documented?' });
      checks.push({ endpoint, security: security.label, references, case: 'Function / role',
        question: 'Which roles may perform this operation? Test a lower-privilege role.' });
      if (references.length > 0) {
        checks.push({ endpoint, security: security.label, references, case: 'Object ownership',
          question: 'Does changing an object reference enforce the caller’s ownership?' });
        checks.push({ endpoint, security: security.label, references, case: 'Tenant boundary',
          question: 'If multitenant, does an object from another tenant stay inaccessible?' });
      }
    }
  }

  return { title: document.info?.title || 'Untitled API', operations, checks };
}

export function toMarkdown(report) {
  const lines = [
    `# Authorization review: ${cell(report.title)}`,
    '',
    `Generated from an OpenAPI description. ${report.operations.length} operations; ${report.checks.length} review cases.`,
    '',
    'This is a review worksheet, not a vulnerability scan. Confirm expected behavior with the API owner before testing an authorized environment.',
    '',
    '| Endpoint | Security in spec | Object references | Review case | Question | Expected behavior | Status | Evidence |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const row of report.checks) {
    lines.push(`| ${cell(row.endpoint)} | ${cell(row.security)} | ${cell(row.references.join(', ') || '—')} | ${cell(row.case)} | ${cell(row.question)} |  | Not reviewed |  |`);
  }
  lines.push('', '## Review notes', '',
    '- A missing OpenAPI security declaration does not prove that the live endpoint is public.',
    '- OpenAPI usually cannot express object ownership or tenant policy. Record the intended rule and evidence for each case.',
    '- Compare this worksheet after API changes; prioritize new routes and changed authorization requirements.', '');
  return lines.join('\n');
}

export function toCsv(report) {
  const columns = ['Endpoint', 'Security in spec', 'Object references', 'Review case', 'Question', 'Expected behavior', 'Status', 'Evidence'];
  const lines = [columns.map(csvCell).join(',')];
  for (const row of report.checks) {
    lines.push([
      row.endpoint, row.security, row.references.join(', '), row.case, row.question, '', 'Not reviewed', '',
    ].map(csvCell).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}
