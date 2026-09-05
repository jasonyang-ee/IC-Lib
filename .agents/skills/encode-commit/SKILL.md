---
name: encode-commit
description: |
  Write concise Conventional Commit messages from a reviewed diff. Use for "/encode-commit" or when preparing a commit message. Prefer a subject under 50 characters; include a body when rationale, compatibility, or repository policy requires it.
---

# encode-commit — summarize a reviewed change

Generate the message only; do not stage, commit, amend, or push. Use the staged diff or caller-supplied reviewed changes. Do not infer intent or claim verification absent from the evidence.

## Format

- Subject: `<type>(<scope>): <imperative summary>`; scope optional.
- Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `build`, `ci`, `style`, `revert`.
- Prefer ≤50 characters; maximum 72 unless repository policy differs. No trailing period.
- Use the affected component as scope. Describe the resulting change in words a reader without planning files understands.
- Add a body for non-obvious rationale, breaking changes, migrations, reverts, security fixes, or required verification evidence. Omit it when the subject suffices.
- Mark breaking changes with `!` and a `BREAKING CHANGE:` footer explaining impact and migration.

Avoid filler, emoji, AI attribution, encoding operators, and transient phase/task ids. Expand spec references into the actual requirement. Preserve literal identifiers when they are needed to explain the change.

## Example

```text
fix(auth): reject expired refresh tokens

Check expiry before issuing a replacement token so an expired
session cannot be extended.

Verified the expiry-boundary regression tests.
```

Use that verification claim only when supported. Follow explicit user and repository message conventions when they differ from these defaults.
