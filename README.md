# OpenAPI Boundary Review

A small, offline tool that turns an OpenAPI 3 JSON file into an authorization review worksheet. It lists operations, declared security schemes and object references, then prompts a reviewer to check authentication, roles, object ownership and tenant boundaries.

It makes **no network requests** and does **not** claim to find vulnerabilities. OpenAPI rarely describes ownership rules; a human must supply expected behavior and test only systems they are authorized to assess.

## Run it

Requires Node.js 20 or newer. No dependencies or installation step.

```sh
git clone https://github.com/Shutaru/openapi-boundary-review.git
cd openapi-boundary-review
node bin/review.mjs examples/shop.openapi.json --output review.md
node bin/review.mjs examples/shop.openapi.json --format csv --output review.csv
```

Omit `--output` to print to the terminal. The tool refuses to overwrite an existing output file.

## What the worksheet includes

- One row per review case, per API operation.
- Security declarations inherited from the OpenAPI root or overridden by an operation.
- Path parameters and query parameters that look like object references.
- Questions for unauthenticated access, role restrictions, ownership and tenant isolation.
- Empty status and evidence fields for the reviewer to complete.

The example describes a fictional shop with a public health endpoint and tenant-scoped invoices. Try changing its security declarations and rerun the tool.

## Limits

- OpenAPI 3.0, 3.1 and 3.2 **JSON** only. YAML, `$ref` expansion and remote inputs are not supported yet.
- Parameter names are hints. They do not prove that an endpoint is vulnerable or even that a particular object exists.
- A missing security declaration does not prove that an endpoint is public in a live deployment.
- This is a planning and evidence worksheet, not an active scanner or policy engine.

## Contribute

Useful additions would be YAML input, richer query/body object references, and examples from real authorization policies with all sensitive details removed. Open an issue with a minimal synthetic OpenAPI sample and the worksheet result you expected. Please do not submit credentials, real customer API descriptions or live target URLs.

## License

MIT. See [LICENSE](LICENSE).
