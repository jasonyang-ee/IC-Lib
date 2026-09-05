---
name: encode-agent
description: |
  Generate a compact, self-contained sub-agent assignment from an orchestrator's bounded context. Use before delegation to carry scope, requirements, verification, stop conditions, and completion evidence without loading parent cycle state.
---

# encode-agent — write a bounded assignment

Generate prompt text only. Do not execute, dispatch, choose a model, or mutate files. Preserve exact paths, identifiers, commands, requirement text, and user decisions.

## Required input

Require objective, allowed write paths (or `none` for read-only work), forbidden actions, relevant requirements/context, verification method and expected result, commit policy, stop conditions, and completion evidence. Distinguish implementation paths from a reporting file writable only for its completion block.

Request missing fields from the caller; do not read parent plan, spec, backlog, or baton to fill gaps. Do not invent tools, permissions, model settings, repository rules, or existing test names. Proposed new tests must be labeled as new.

## Assignment contract

Carry these rules into the generated prompt:

- Read needed repository guidance and surrounding context within allowed access. Write only assigned paths; permission to inspect a dependency is not permission to edit it.
- Make the smallest coherent change and reuse established patterns. For read-only work, return findings and evidence without manufacturing a diff.
- Establish verification before editing. Use meaningful tests for behavior and explicit inspection/source criteria for research or documents. A new regression test may be expected to fail before the fix.
- Run required checks, classify failures before retrying, and distinguish introduced defects from baseline/environment failures. Continue in-scope diagnosis; do not hide failed or unavailable proof.
- Review the complete scoped diff and requirement coverage before completion. Repeat affected checks after corrections.
- Stop dependent work for unresolved requirement conflicts, needed scope expansion, missing authority, or unavailable required evidence. Preserve progress and report the smallest decision needed.
- Do not alter parent cycle state, delegate again, commit, push, tag, or perform destructive live-system actions unless the assignment explicitly authorizes that action.

## Output

Emit one filled prompt. Include the applicable contract above in `quality` and `stop`, not merely a reference to this skill.

```md
# assignment <id>
objective: <outcome>
scope: <allowed write paths or none; reporting path and block authority>
read: <needed context and any access limits>
forbidden: <paths/actions>

## requirements
- <requirement text, user decision, or existing pattern>

## work
1. <action with enough context to execute>

## verify
- <command or inspection method> → <expected result; existing/new test if relevant>

## quality
- <applicable assignment contract>

## stop
- <conflict, authority, scope, or proof boundary; what to report>

## commit
<do not commit | authorized commit convention>

## completion
status: <done | blocked: reason>
evidence: <file:line or source + result; decisions and deviations>
tests: <command + result | inspection method + result | not run: reason>
remaining: <unfinished work or none>
```

Keep required sections and use `none` for optional empty fields. Preserve dependencies, uncertainty, and failure conditions when compressing. The worker must be able to act without parent conversation history.
