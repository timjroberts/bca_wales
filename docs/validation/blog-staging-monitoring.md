# Restricted staging backup monitoring

This validation belongs to [Establish scheduled blog backup health and failure monitoring](https://github.com/timjroberts/bca_wales/issues/126), which blocks [Demonstrate BCA Wales blog staging and provider launch gates](https://github.com/timjroberts/bca_wales/issues/118).

## Scope and implementation

The owner authorized continuing from the merged recovery fix into monitoring and daily backups on 10 September 2026. The recovery fix is merged as `cab9d96ad51650ccf1e5d6579b11b2e1defb2261`. This step uses only `bca-wales-blog-staging`, its existing EU D1 database, private staging content bucket and private staging recovery bucket. Authentication remains disabled, publication paused and application access restricted. No production routes, DNS or paid plan activation are part of this step.

The independent health credential is a random 32-byte secret installed as Worker secret `MONITOR_TOKEN` and repository Actions secret `BLOG_STAGING_MONITOR_TOKEN`. The local copy is an ignored mode-0600 file in the private operator credentials directory. It grants only read access to aggregate health at `/api/ops/health`; it is separate from account/session, D1, R2 and deployment credentials. Provider request logging remains disabled.

The hourly scheduled handler records success/failure timestamps. The endpoint fails for missed maintenance (three hours), overdue paired backup (26 hours), disabled backups/unconfirmed retention, or unfinished cleanup/recovery work. A terminated invocation that cannot write a failure marker is detected by overdue success. The GitHub watchdog independently checks HTTP status, response shape and timestamp freshness every half hour, with a 20-second request timeout and no redirects.

## Local validation

All 34 blog tests pass, including three new scenarios for restricted health authorization and failure states, scheduled paired backup and sanitized failure recording, and watchdog rejection of stale/malformed/error responses. The actual bundled Worker rejects uncredentialed requests, query-only credentials, wrong origins and unsupported methods; a monitor credential cannot open application or administrator routes. HEAD has no body, successful health responses set private/no-store and no cookies. Focused ESLint and whitespace checks pass.

## Hosted validation

The deployed code is Worker version `120c4653-639d-4d42-a495-7e59889e4e60`, built from the source now committed as `3a92a8c`. The deployment reported 167.06 KiB uploaded (50.38 KiB gzip) and 4 ms startup. `BACKUPS_ENABLED` and `BACKUP_RETENTION_CONFIRMED` are true; `AUTH_ENABLED=false`, `RESTRICTED=true` and `PUBLISH_PAUSED=true` remain unchanged. Logs/traces remain disabled.

A temporary every-minute cron was accepted at 12:04:07 UTC and last updated at 12:06:40. The synthetic staging database's `last_backup` marker was temporarily set to zero to make the existing paired-backup code due; the real backup receipts were preserved. One uniquely identified, expired synthetic staging lease with no writer was inserted to exercise failure detection.

The real health endpoint reported 503, `staleStaging: 1`, and `operator_attention`. The exact watchdog CLI exited 1 with only its generic diagnostic. Unauthenticated monitoring returned 404, and `/blog/`, `/api/session` and `/api/admin/health` stayed restricted even with the monitor credential.

**Scheduled execution was not demonstrated.** Through 12:22:35 UTC, neither a maintenance success/failure marker nor a new backup appeared. This exceeds 15 minutes after the last trigger update. Cloudflare accepted the cron configuration; the dashboard's cron history remained empty and warned that new Workers' history may lag by 30 minutes. The overview metrics showed no CPU/memory/invocation errors at inspection, but that does not prove a cron ran. The cause of the missing execution is not established. See [Cloudflare trigger propagation](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

At 12:22:38 the hourly `0 * * * *` schedule was restored and verified through the provider API. Only the owned synthetic lease was removed. The genuine `last_backup=1789039909` was restored conditionally on its still being zero, so no later backup could be overwritten. Its existing paired manifest, database and four copied objects were independently checksum-verified; this is the earlier operator-created backup documented in [restricted recovery validation](blog-staging-recovery.md), not a new scheduled backup. Backups remain enabled for the normal hourly handler.

No successful heartbeat was fabricated to turn the monitor green. It continues to report missing maintenance after cleanup. Actual cron execution, scheduled failure/recovery and a new paired backup therefore remain open in the linked ticket.

## Remaining launch gates

The new GitHub workflow must be merged to the default branch before its recurring schedule is active. A deliberately failed hosted workflow, recovery, and actual notification receipt must then be demonstrated. The prepared repository secret alone does not establish alert delivery. The owner’s GitHub notification settings were inspected: Actions email notifications are already enabled for failed workflows only, using the existing default address. No notification settings were changed. Actual receipt for this new watchdog remains unproved; inspect its recent runs as well.

GitHub schedules can be delayed or dropped, and public-repository inactivity can disable schedules after 60 days. This is best-effort monitoring, not a guaranteed delivery deadline. See [GitHub schedule constraints](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) and [workflow notifications](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs).

The inspected account is on Workers Free. Its documented CPU allowance is 10 ms per invocation; a tiny successful rehearsal cannot establish the retained-content capacity required at launch. See [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/). Representative backup load, real Meta authentication/callbacks and crawler behavior, Images runtime, private-key retirement/reenrolment, privacy contact, DNS reconciliation and the whole-account budget remain separate launch gates.
