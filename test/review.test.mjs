import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { analyseOpenApi, toCsv, toMarkdown } from '../src/review.mjs';

const fixture = JSON.parse(await readFile(new URL('../examples/shop.openapi.json', import.meta.url), 'utf8'));

test('respects operation security overrides and inherited security', () => {
  const report = analyseOpenApi(fixture);
  assert.equal(report.operations.length, 4);
  assert.equal(report.operations.find((row) => row.endpoint === 'GET /health').security, 'No scheme required in spec');
  assert.equal(report.operations.find((row) => row.endpoint.includes('invoices/{invoiceId}')).security, 'bearerAuth');
});

test('generates ownership and tenant review cases for identifiers', () => {
  const report = analyseOpenApi(fixture);
  assert.equal(report.checks.filter((row) => row.endpoint === 'GET /health').length, 2);
  assert.equal(report.checks.filter((row) => row.endpoint === 'GET /invoices').length, 4);
  assert.deepEqual(report.operations.find((row) => row.endpoint === 'GET /invoices').references, ['query:accountId']);
  assert.deepEqual(report.operations.find((row) => row.endpoint.includes('invoices/{invoiceId}')).references, ['tenantId', 'invoiceId']);
});

test('renders an editable worksheet without executing requests', () => {
  const report = analyseOpenApi(fixture);
  assert.match(toMarkdown(report), /\| GET \/health \| No scheme required in spec/);
  assert.match(toCsv(report), /"GET \/health","No scheme required in spec"/);
});

test('escapes untrusted document text in Markdown and CSV', () => {
  const document = {
    openapi: '3.1.0', info: { title: '<script>alert(1)</script>' },
    paths: { '/safe': { get: { security: [{ '=HYPERLINK("bad")': [] }] } } },
  };
  const report = analyseOpenApi(document);
  assert.match(toMarkdown(report), /&lt;script&gt;/);
  assert.match(toCsv(report), /'=HYPERLINK/);
});

test('rejects unsupported or malformed specifications', () => {
  assert.throws(() => analyseOpenApi({ swagger: '2.0', paths: {} }), /OpenAPI 3/);
  assert.throws(() => analyseOpenApi({ openapi: '3.1.0', paths: [] }), /paths must be an object/);
});
