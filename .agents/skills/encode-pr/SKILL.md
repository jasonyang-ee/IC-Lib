---
name: encode-pr
description: |
  Turn evidenced PR findings into concise, actionable review comments with location, problem, impact, and fix direction. Use for "/encode-pr". Expand beyond one line when needed to explain security, architecture, or uncertainty.
---

# encode-pr — make findings actionable

Draft comments only; do not post, approve, request changes, or implement fixes. Use supplied evidence or inspect relevant context before making a claim.

## Format

Prefer `<file>:L<line>: <problem and impact>. <fix direction>.` Omit the file only for an unambiguous single-file review. Use the smallest relevant line range; never invent a location.

Optional labels:

- `bug:` demonstrated incorrect behavior;
- `risk:` concrete failure mode with stated conditions;
- `nit:` optional style or naming preference;
- `q:` unresolved question whose answer affects the review.

Remove throat-clearing, praise, repeated descriptions of the diff, and vague requests to refactor. Preserve exact identifiers, triggering conditions, consequence, and uncertainty. A concise comment must not turn a suspicion into a fact.

Recommend a specific fix direction only when supported by the surrounding code. Do not invent helpers, retry counts, or architecture. Avoid comments based only on function length or personal style.

## Examples

- `users.ts:L42: bug: find() can return undefined, so reading user.email throws for an unknown id. Handle the missing-user result before accessing email.`
- `client.ts:L23: risk: a 429 immediately fails the request. Honor Retry-After with bounded retries if this operation is safe to retry.`

Use a paragraph for security impact, architectural tradeoffs, or an order-sensitive fix that one line cannot explain. Match repository review conventions and the user's requested level of detail.
