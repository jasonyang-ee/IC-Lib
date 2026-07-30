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

## Identity lifecycle & deprovisioning — deferred

**Status:** not started. Split out of the 2026-07-29 auth cycle. That cycle (`PLAN.md` F1-F6) covers *authentication* federation and *authorization* role derivation only. It deliberately does **not** deactivate departed users — the request below is the missing third function.

### Settled architecture (from the 2026-07-29 authentication review — do not re-litigate)

Three functions are separate and need not share a mechanism:

1. **Authentication** — verify the person is an AD user. → Entra ID direct OIDC. Landed/landing in the F1-F6 cycle.
2. **Provisioning** — create/update/disable/remove the app account. → **this backlog entry.**
3. **Authorization** — decide what they may view/edit/approve/administer. → app-local, via `oidc_role_mappings` + `role_source` (SPEC §V54) plus record-level permissions. Landing in the F1-F6 cycle.

Rulings that constrain any future work here:

- **Keycloak is a hard no** for the AD auth process (user requirement), which removes options 1-6 of the reviewed architectures regardless of their merits.
- **Direct LDAP bind is rejected** — it is the only reviewed architecture that exposes AD passwords to the application, and it also forces the app to own lockout, session, password-expiry and reset behavior, and makes domain-controller availability into application availability.
- **Generic OIDC support stays** alongside Entra, for deployments that want OIDC without AD.
- **Identity keys must be immutable.** Never key on username or email — both change (name changes, domain migration, employee replacement). SPEC §V29 keys on (`oidc_issuer`, `oidc_sub`) and additionally persists Entra `oid` as `users.oidc_object_id`.
- **Never delete a departed user's row.** AD disabled → app account marked inactive → all historical authorship, approvals, and audit entries stay attributable. This system is intended to preserve decades of engineering records; audit attribution outliving employment is a requirement, not a nicety.

### The actual deferred request

Authentication alone does not make a terminated user disappear from the app database. Today nothing sets `users.is_active` from the directory — an account disabled in AD keeps working in IC-Lib until an admin notices. Options reviewed, best-first:

- **SCIM 2.0 endpoint in IC-Lib** (`POST/PATCH/GET /scim/v2/Users`, `POST/PATCH /scim/v2/Groups`) that Entra provisions into. Most standards-based choice: gives pre-provisioning before first login, automatic profile updates, group sync, automatic deactivation, and assignment scoping — and cleanly separates provisioning from authentication. <https://learn.microsoft.com/en-us/entra/identity/app-provisioning/use-scim-to-provision-users-and-groups>
- **Microsoft Graph delta-query sync** from a background service — more control than SCIM (custom attribute transforms, nested groups, attributes outside the SCIM schema) at the cost of custom code. <https://learn.microsoft.com/en-us/graph/delta-query-overview>
- **On-prem AD sync agent** — only if Entra is unavailable or the app cannot reach domain controllers; outbound-only from the AD network. Custom software, so prefer SCIM.

Also still open from the same review:

- Local break-glass admin policy: SPEC §V29 keeps local login working, but there is no explicit rule that at least one local admin must remain, nor a check that prevents an admin from federating the last one away.
- Groups-overage resolution via Graph: SPEC §V56 currently fails closed for users in >200 groups (§R4). Resolving properly needs Graph `Group.Read.All` + `User.Read.All`, admin consent, and a separate token. Only worth building if a real user actually trips the limit.
- Whether `is_active=false` should also revoke an already-issued JWT cookie (24h lifetime per §V1) or only block the next login. Today it only blocks login, so a disabled user keeps a live session for up to 24h.
