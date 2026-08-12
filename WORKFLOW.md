# Development Workflow — Staged Pipeline

This repo uses a staged, module-by-module pipeline: every change moves through
`feature branch → dev → test → uat → main`, with an agent responsible for
each stage and a human required at the one point that actually matters —
signoff before production.

## Branches

```
main   ← production. Every commit here has been through the full pipeline.
uat    ← user-acceptance stage.
test   ← QA/verification stage.
dev    ← integration branch for in-progress modules.
feature/<module-name>  ← one branch per module, cut from dev.
```

## Stages and agents

| Stage | Agent | Branch | Can write code? | Can approve/merge? |
|---|---|---|---|---|
| Build | `dev-agent` | `feature/<module>` | Yes | No |
| Verify | `test-agent` | reviews `feature/<module>` vs `dev` | No | No |
| Accept | `uat-agent` | reviews the branch after test passes | No | No |
| Prepare signoff | `signoff-agent` | writes `signoff/<module>-signoff.md` | Package only | No |
| **Human signoff** | **you** | reviews the signoff package | — | **Yes — this is the only approval step** |
| Release | `release-agent` | merges `feature/<module>` → `dev` → `test` → `uat` → `main`, tags it | No | Executes your approval, doesn't grant it |

**Why signoff is human-only**: this is a banking regulatory tool. An agent
recommending "ready" is not the same as this being approved for production,
and letting an agent self-approve its own merge would undermine the audit
trail this pipeline exists to create.

## Versioning

Each module release is git-tagged on `main`:

```
v<version>-<module-name>
```

e.g. `v0.3.0-reconciliation`. The app deploys as a single Next.js monolith
(no independent microservice boundaries exist today), so this gives you a
clear per-module version history without implying independent deployability
that the current architecture doesn't actually have.

## Running a module through the pipeline

1. `dev-agent` builds the module on `feature/<module-name>` (cut from `dev`).
2. `test-agent` reviews the diff, runs lint/build, and functionally verifies
   it in the browser. Produces a PASS/FAIL report.
3. `uat-agent` walks the real business flow and produces an acceptance
   checklist in plain language.
4. `signoff-agent` compiles both reports plus a diff summary into
   `signoff/<module-name>-signoff.md` and recommends ready/not-ready —
   this is a recommendation, not an approval.
5. **You review the signoff package and explicitly approve or reject it.**
6. Only after your explicit approval, `release-agent` merges the branch
   through `dev → test → uat → main`, tags the release, and updates
   `CHANGELOG.md`.

No remote is configured yet — everything above happens locally until a
remote (and the decision to push to it) is explicitly set up.
