# Engineering guidelines

- Keep the CLI generic and independent of any website or project.
- Use strict TypeScript ESM and Node.js 24-compatible APIs.
- Never mutate source images. Preserve collision-safe names, atomic publication, bounded concurrency and explicit size-target failures.
- Validate input before writing. Test real generated images and the installed npm tarball.
- Run lint, formatting, type checking, tests, build and package verification before proposing changes.
- Keep architecture lightweight. Additional commands should reuse discovery and conversion functions where appropriate.
- Do not publish npm packages, merge PRs, tag releases or change repository security settings without explicit approval.
- Avoid em dash punctuation in source comments and documentation.
