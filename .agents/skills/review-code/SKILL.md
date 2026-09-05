---
name: review-code
description: |
  Review implementation changes against an explicit baseline or the latest reachable release tag. Trace correctness, security, complexity, reuse, and requirement drift; report evidenced findings and GO or NO-GO. Hand accepted follow-up work to prep when planning is authorized. Use for "/review-code".
---

# review-code — review implementation changes

Inspect the change and its surrounding system. Produce actionable findings without editing implementation. A review request alone does not authorize creating a new planning cycle.

## Baseline and scope

Use the user's explicit baseline first; otherwise use the latest reachable release tag matching `v<major>.<minor>.<patch>`. If none exists, inspect repository release documentation for a recorded baseline. Ask only if the intended comparison still cannot be established; never substitute an arbitrary commit.

Record baseline ref/SHA, HEAD, branch, and dirty-tree state. Review baseline-to-HEAD changes by default. Include uncommitted work when requested or clearly within the user's scope, and distinguish it from committed changes.

Read repository guidance, relevant `SPEC.md` sections, and `PLAN.md`/`HANDOFF.md` if present. These files provide context; an incomplete plan does not prohibit reviewing existing work. Never ingest `BACKLOG.md`.

## Review procedure

1. Inventory changed surfaces and separate behavior changes from mechanical edits. Read affected files and enough callers, dependencies, and tests to understand consequences.
2. Trace entrypoints, persistence, state transitions, error paths, and boundary cases. Check that interfaces, ownership, naming, and failure handling remain coherent.
3. Search for existing helpers before proposing reuse or new abstractions. Recommend simplification only when it removes demonstrated complexity without obscuring requirements.
4. Check relevant security boundaries: credentials, untrusted input, injection, authorization, sensitive data, and dependency changes. Distinguish demonstrated defects from optional hardening.
5. Run documented checks applicable to the scope and focused checks for suspected defects. Reuse current results; broaden testing only for changed code, failures, or unresolved concerns. Distinguish failures introduced by the change, pre-existing failures, and environment limits.
6. Cite each finding by file/line, test, commit, or primary source. Explain the trigger, impact, and fix direction. Tests passing do not excuse missing coverage or flawed assertions.
7. Classify findings and report the gate. Resolve routine review choices from context; ask only when baseline, intent, scope, or authority materially changes the review.

## FINDING TAXONOMY & GATE

Keep this section identical in `review-plan` and `review-code`. Assign each finding one category:

- **BLOCK** — an evidenced correctness, safety, or release defect, including a demonstrated security vulnerability. Fix before proceeding.
- **DIVERGENCE** — work conflicts with a stated `SPEC.md` requirement. Resolve against user intent: fix the work or amend a superseded requirement through `encode-docs`. Existing behavior alone does not justify weakening a requirement.
- **UNKNOWN** (`?`) — a question requiring repository evidence, current primary sources, or a user decision. State whether it blocks and why. An unresolved question affecting correctness, safety, scope, or required verification remains blocking.
- **HARDEN** — an optional, evidenced improvement to resilience, tests, complexity, or reuse. Speculative security advice is not a demonstrated vulnerability.
- **NOTE** — context with no required action. Label unsupported observations `[unverified]`; investigate consequential uncertainty as UNKNOWN.

**NO-GO** if any open BLOCK, DIVERGENCE, or blocking UNKNOWN remains. **GO** otherwise. HARDEN and NOTE do not block. Report resolved findings separately from open counts. GO applies only to the reviewed scope; it does not authorize deployment, merging, or additional work.

## Follow-up

For DIVERGENCE, use explicit user intent and existing decisions to determine whether the work or spec should change. Ask when that choice remains unresolved; never amend a requirement merely to excuse a defect.

If the user authorized follow-up planning, load `prep` with accepted findings, evidence, baseline, gate, and decisions. It owns the new plan/baton pair or queues requests when execution is active. A remediation plan still starts with research/confirmation before fixes. If no actionable work is accepted, finish with the review; do not manufacture an empty cycle.

## REPORT OUTPUT

Keep this section identical in `review-plan` and `review-code`. Lead with the verdict and scope. For each finding, give location/evidence, problem, concrete impact, and fix direction. Preserve exact paths, identifiers, errors, and uncertainty.

Use concise plain language. Omit empty categories and repeated evidence. Prefer a full sentence when compression would obscure causality, security impact, or an order-sensitive fix. State verification limits; never imply that green checks prove unexamined behavior.

## Boundaries

Explicit user instructions override skill guidance within higher-priority instructions and permissions. Explain a rule-caused pause with its file and wording. This review does not edit implementation, tests, or cycle documents directly, commit changes, post comments, or approve a PR. Separate authorization is needed for those actions unless already supplied by the user.
