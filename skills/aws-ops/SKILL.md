---
name: aws-ops
description: Work safely with AWS through the AWS CLI or an AWS MCP server - confirm account, profile and region first, read before you write, least-privilege IAM, plan changes with rollback, approval before anything that creates, changes, deletes or costs money, and no account ids, ARNs or secrets in docs or commits. Use for any AWS task - EC2, ECS, Lambda, S3, RDS, IAM, CloudWatch logs, Secrets Manager, cost questions.
---

# AWS operations

## 0. Where am I?
```bash
aws sts get-caller-identity --output table      # who, which account
aws configure list                              # profile and region in use
```
State the profile, region and environment (dev / staging / prod) before any other command. If it is prod and the task did not say prod, stop and ask.

## 1. Read first (no approval needed)
`describe-*`, `list-*`, `get-*`, `logs tail`, `cloudwatch get-metric-data`, `ce get-cost-and-usage`. Use `--query` and `--output table|json` to keep output short. Never print secret values (`secretsmanager get-secret-value`, `ssm get-parameter --with-decryption`) into the chat; check that they exist, not what they are.

## 2. Change = plan + approval
Anything that creates, updates, deletes, scales, restarts, opens a port, changes IAM or costs money needs a typed "yes" from a human in this session. Before asking, show:
1. The exact command(s) or IaC diff (`terraform plan`, `cdk diff`, `sam deploy --no-execute-changeset`, CloudFormation change set).
2. What changes, blast radius, cost estimate if any.
3. Rollback command or steps.

Prefer infrastructure as code over console or ad-hoc CLI changes. Use `--dry-run` where the API supports it (EC2).

## 3. Safety rules
- Least privilege: scoped IAM policies, no `*:*`, no long-lived access keys for workloads (use roles); MFA for humans.
- S3: block public access by default; encryption on; versioning for important buckets.
- Security groups: no `0.0.0.0/0` on admin ports (22, 3389, database ports).
- Secrets live in Secrets Manager or SSM Parameter Store, never in env files committed to git, task definitions in the repo, or user data.
- Tag resources (owner, env, project) so cost and cleanup are traceable.
- Never `delete-*`, `terminate-instances`, `rb --force`, `s3 rm --recursive` or `cloudformation delete-stack` without explicit approval naming the resource.

## 4. Docs and commits
Write `<account-id>`, `<region>`, `<bucket>`, `<role-arn>` placeholders in docs, examples and commit messages. Real ids go in the team's private runbook or secret store, not the repo.

## 5. Debug checklist
Logs (`aws logs tail <group> --since 30m --follow`), recent deploys, health checks / target group health, IAM `AccessDenied` (read the denied action and resource in the message), quotas, network path (security group, NACL, route table, VPC endpoint).

## Report
Account alias or env (not the id), region, commands run, result, what changed, rollback, cost impact.
