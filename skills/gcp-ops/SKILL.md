---
name: gcp-ops
description: Work safely with Google Cloud through gcloud, gsutil or bq - confirm account, project and region first, read before you write, least-privilege IAM, plan changes with rollback, approval before anything that creates, changes, deletes or costs money, and no project ids, service-account emails or keys in docs or commits. Use for any GCP task - Compute Engine VMs, Cloud Run, GKE, Cloud SQL, Cloud Storage, IAM, logging, Secret Manager, billing questions.
---

# GCP operations

## 0. Where am I?
```bash
gcloud config list                       # account, project, region, zone
gcloud auth list
```
State the project, region and environment (dev / staging / prod) before any other command. Pass `--project` explicitly in scripts instead of relying on the active config. If it is prod and the task did not say prod, stop and ask.

## 1. Read first (no approval needed)
`describe`, `list`, `gcloud logging read`, `gcloud run services describe`, `gcloud compute instances list`, `gcloud sql instances describe`. Use `--format="table(...)"` or `--format=json` with `--limit` to keep output short. Never print secret payloads (`gcloud secrets versions access`) into the chat; check that they exist.

## 2. Change = plan + approval
Anything that creates, updates, deletes, resizes, restarts, deploys, opens a firewall rule, changes IAM or costs money needs a typed "yes" from a human in this session. Before asking, show:
1. The exact command(s) or IaC diff (`terraform plan`, `gcloud deploy ... --dry-run` where supported, a Cloud Run revision with `--no-traffic`).
2. What changes, blast radius, cost estimate if any.
3. Rollback (for Cloud Run: `gcloud run services update-traffic <svc> --to-revisions=<previous>=100`; for VMs: snapshot first).

## 3. Safety rules
- Least privilege: predefined or custom roles on the narrowest resource; no `roles/owner` or `roles/editor` for workloads; prefer Workload Identity and attached service accounts over JSON key files. Never create or download service-account keys without approval.
- Storage: uniform bucket-level access, public access prevention on, no `allUsers` bindings unless the bucket is meant to be public.
- Firewall: no `0.0.0.0/0` on SSH, RDP or database ports; use IAP for SSH.
- Secrets in Secret Manager, never in env files in git, startup scripts or instance metadata.
- Labels on resources (owner, env, project).
- Never `delete`, `gsutil rm -r`, `gcloud projects delete`, `sql instances delete` or a VM stop in prod without explicit approval naming the resource.

## 4. Docs and commits
Use `<project-id>`, `<region>`, `<service-account>`, `<vm-name>` placeholders in docs, examples and commit messages. Real ids stay in the private runbook or secret store.

## 5. Debug checklist
`gcloud logging read 'resource.type="cloud_run_revision" AND severity>=ERROR' --freshness=30m --limit=50`, recent revisions or deploys, health checks, IAM `PERMISSION_DENIED` (read the permission named), quotas, VPC connector / firewall / NAT path, Cloud SQL connections.

## Report
Project alias or env (not the id), region, commands run, result, what changed, rollback, cost impact.
