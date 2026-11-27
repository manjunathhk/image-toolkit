# Contributing

Use Node.js 24 or later and npm. Run `npm ci` and the verification commands in README.md. Work on a feature branch, link a GitHub issue, and submit a PR with the problem, resulting behaviour and validation results. Generate fixtures in tests rather than committing large binaries. Keep package-lock.json current. Publishing and merging require owner approval.

## Publishing

Node 26 is the development and publishing default in `.nvmrc`; Node 24 remains the minimum supported runtime and stays in CI.

Publishing is manual: merge an approved version and changelog to main, then select **Actions > Publish to npm > Run workflow**, choose **main**, and enter the exact package.json version. This dispatch authorizes publishing that version. The workflow validates all six OS/Node combinations before publishing a freshly built tarball. It skips an already-published version and fails on registry errors. Only stable X.Y.Z versions are supported. It never creates tags or GitHub releases. A workflow dispatch on any other branch skips all jobs.

One-time npm setup for `@manjunathhk/image-toolkit`:

1. Ensure the npm account owns the `@manjunathhk` scope. If the package does not yet exist, bootstrap its first publication from an approved main checkout using `npm login`, the README verification commands, and `npm publish --access public`. This is a separate, explicit owner action.
2. In the package's npm settings, add a GitHub Actions trusted publisher: user **manjunathhk**, repository **image-toolkit**, workflow filename **publish.yml**. Leave environment empty because this workflow does not use one. Enable direct **npm publish** permission.
3. No `NPM_TOKEN` repository secret is needed. GitHub-hosted runners use OIDC with `id-token: write`; Node 26 bundles a compatible npm CLI (trusted publishing requires npm 11.5.1 or later). npm attaches provenance to CI publications.

Trust is configured per package; existing design-tokens and social-card-generator settings do not cover image-toolkit. See [npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).
