#!/usr/bin/env node
import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { analyseOpenApi, toCsv, toMarkdown } from '../src/review.mjs';

function usage() {
  return 'Usage: node bin/review.mjs <openapi.json> [--format markdown|csv] [--output <file>]\n';
}

async function main(args) {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(usage());
    return;
  }
  let input;
  let output;
  let format = 'markdown';
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--format' || arg === '--output') {
      const value = args[++index];
      if (!value) throw new Error(`${arg} needs a value`);
      if (arg === '--format') format = value;
      else output = value;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!input) {
      input = arg;
    } else {
      throw new Error('Only one input file is supported');
    }
  }
  if (!input) throw new Error(usage().trim());
  if (!['markdown', 'csv'].includes(format)) throw new Error('Format must be markdown or csv');
  if (output && resolve(output) === resolve(input)) throw new Error('Output must differ from input');

  const details = await stat(input);
  if (!details.isFile() || details.size > 10 * 1024 * 1024) {
    throw new Error('Input must be a JSON file of 10 MB or less');
  }
  const document = JSON.parse((await readFile(input, 'utf8')).replace(/^\uFEFF/, ''));
  const report = analyseOpenApi(document);
  const result = format === 'csv' ? toCsv(report) : toMarkdown(report);
  if (output) await writeFile(output, result, { encoding: 'utf8', flag: 'wx' });
  else process.stdout.write(result);
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
});
