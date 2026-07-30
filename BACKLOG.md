# BACKLOG

Pending prep inputs. Only ingested by `/prep`.

---

## Alternative rating system — Class A/B/C

**Status:** not started. Deliberately deferred out of the 2026-07-29 auth cycle (see `PLAN.md`) to keep that cycle's scope to auth only. This entry is the full request plus the design decisions already settled, so a cold `/prep` can plan it without re-asking.

### Request

Add an alternative rating system rating components Class A, B, C:

- **Class A** — cannot replace unless direct approval.
- **Class B** — can replace following drawing notes.
- **Class C** — can replace following just the component's value.

This is a system for evaluating the criticality of components in a design or assembly. Mostly applied to passive components, this rating helps speed up the PCB build process by allowing a generic resistor or capacitor when the original specified part is not available, while still maintaining the integrity of the design.

### Decisions already made (user ruling, 2026-07-29)

**Attachment point — component default + per-BOM-line override.** Chosen over component-only and per-alternative-row:

```
components.alt_class          CHAR(1) NULL  -- library default
project_components.alt_class  CHAR(1) NULL  -- per-design override

resolved = COALESCE(bom_line.alt_class, component.alt_class)

0402 100nF X7R  -> library default C
  in PROJ-17 as loop-comp cap -> override A
```

Rationale for rejecting the alternatives: component-only cannot express that the same 100nF is generic in most designs and critical in one; per-alternative-row (`components_alternative.alt_class`) rates only *listed* substitutes and so cannot express "this position takes any generic 100nF", which is the whole point of Class C. The hybrid was chosen specifically to avoid a painful migration later.

### Open questions for `/prep` to resolve

- Is the class ECO-governed? A change from C to A on a `production` part is a real engineering change — likely yes, staged as a normal field change under §V15/§V21, but confirm. Does it need its own pipeline tag (§V12) or does the existing `spec` tag cover it?
- Does Class A imply an approval gate at *consume* time (Inventory `Consume All`, §V48) or is it advisory metadata only?
- Should the class appear in the BOM export column picker (§V17, §V48, `client/src/utils/bomExport.js`)? Almost certainly yes — a builder reading the BOM is the primary consumer of this rating.
- Does the OrCAD/CIS compat surface need it? Adding a column to the `production_parts`/`prototype_parts`/`alternative_parts` views touches §C4's locked external ODBC surface — probably leave the views alone, but decide explicitly.
- Is a NULL class meaningful (unrated) or should it default to A (fail-safe: nothing is substitutable until someone says so)? Fail-safe default is the safer engineering choice but will mark the entire existing library as Class A on migration.
- Where is it edited — Library add/edit form (§V41), a bulk category-level default, or both? Bulk matters: rating an existing library part-by-part is impractical.

### Likely touch points

`database/migrations/<next>_alt_class.sql`, `database/init-schema.sql`, `server/src/controllers/componentController.js`, `server/src/controllers/projectController.js`, `server/src/services/schemaInspectionService.js`, `client/src/components/library/` (add/edit + detail view), `client/src/components/projects/`, `client/src/utils/bomExport.js`, `SPEC.md` §V (new invariant for the resolution rule + default policy).

---

## Client `no-shadow` cleanup — 7 pre-existing violations

**Status:** not started. Split out of the 2026-07-29 remediation cycle deliberately (see `PLAN.md` F2.T7) to keep a login-outage fix from dragging 7 unrelated refactors along with it.

Enabling plain `'no-shadow': 'error'` in `client/eslint.config.js` currently fails the client lint gate. None of these is logger-related — the client has no logger util, so §V58's clause is satisfied there by a narrower `no-restricted-syntax` selector instead. Verified against installed eslint v9.39.4 (see `SPEC.md` §R7):

- `client/src/contexts/AuthContext.jsx:47` — `user` shadows the outer declaration at line 18
- `client/src/pages/Inventory.jsx:150` — `location` shadows line 25
- `client/src/pages/Library.jsx:732`, `:1115`, `:1586`, `:2359` — `distributors` shadows line 515
- `client/src/pages/Library.jsx:2419` — `response` shadows line 2365

Fix each by renaming the inner binding, then upgrade `client/eslint.config.js` from the narrow selector to full `'no-shadow': 'error'` so all three workspaces share one rule. Low risk, no behavior change, but touches two of the largest page components — worth its own pass with the full suite green.

---

## Directory deprovision sync — still absent

**Status:** not started, and explicitly out of scope per `SPEC.md` §V57 ("Directory disable/deprovision sync ∄ this cycle").

The OIDC cycle landed authentication only. A user disabled in the directory keeps working until their app JWT expires (≤24h per §V1), after which IdP re-auth plus the local `is_active` check governs the next login. Closing that window needs a provisioning channel, not an auth change. Candidates, in rough order of standards-fit:

1. **Entra SCIM** — expose a SCIM 2.0 endpoint; Entra sends create/update/deactivate. Most standards-based, gives pre-provisioning and automatic deactivation.
2. **Microsoft Graph delta query** — background poll for user enabled/disabled state. More control, more custom code.
3. **Custom on-prem AD agent** — outbound-only from the AD network, calls an app provisioning API. Only if Entra is unavailable.

Whichever is chosen must honor §V57's retention rule: deactivate and retain the row, never `DELETE`, so historical authorship/approval/audit references survive.
