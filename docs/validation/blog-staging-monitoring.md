# Restricted staging backup monitoring

This validation belongs to [Establish scheduled blog backup health and failure monitoring](https://github.com/timjroberts/bca_wales/issues/126), which blocks [Demonstrate BCA Wales blog staging and provider launch gates](https://github.com/timjroberts/bca_wales/issues/118).

## Scope and implementation

The owner authorized continuing from the merged recovery fix into monitoring and daily backups on 10 September 2026. The recovery fix is merged as `cab9d96ad51650ccf1e5d6579b11b2e1defb2261`. This step uses only `bca-wales-blog-staging`, its existing EU D1 database, private staging content bucket and private staging recovery bucket. Authentication remains disabled, publication paused and application access restricted. No production routes, DNS or paid plan activation are part of this step.

The independent health credential is a random 32-byte secret installed as Worker secret `MONITOR_TOKEN` and repository Actions secret `BLOG_STAGING_MONITOR_TOKEN`. The local copy is an ignored mode-0600 file in the private operator credentials directory. It grants only read access to aggregate health at `/api/ops/health`; it is separate from account/session, D1, R2 and deployment credentials. Provider request logging remains disabled.

The hourly scheduled handler records success/failure timestamps. The endpoint fails for missed maintenance (three hours), overdue paired backup (26 hours), disabled backups/unconfirmed retention, or unfinished cleanup/recovery work. A terminated invocation that cannot write a failure marker is detected by overdue success. The GitHub watchdog independently checks HTTP status, response shape and timestamp freshness every half hour, with a 20-second request timeout and no redirects.

## Local validation

All 34 blog tests pass, including three new scenarios for restricted health authorization and failure states, scheduled paired backup and sanitized failure recording, and watchdog rejection of stale/malformed/error responses. The actual bundled Worker rejects uncredentialed requests, query-only credentials, wrong origins and unsupported methods; a monitor credential cannot open application or administrator routes. HEAD has no body, successful health responses set private/no-store and no cookies. Focused ESLint and whitespace checks pass.

## Hosted validation

Hosted rehearsal results are recorded below after observing real Cloudflare scheduled invocations. Running the same functions through a local operator is not evidence of a hosted cron execution.

## Remaining launch gates

The new GitHub workflow must be merged to the default branch before its recurring schedule is active. A deliberately failed hosted workflow, recovery, and actual notification receipt must then be demonstrated. The prepared repository secret alone does not establish alert delivery. The owner must enable the intended GitHub Actions notification destination and inspect recent watchdog runs.

GitHub schedules can be delayed or dropped, and public-repository inactivity can disable schedules after 60 days. This is best-effort monitoring, not a guaranteed delivery deadline. See [GitHub schedule constraints](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) and [workflow notifications](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs).

The inspected account is on Workers Free. Its documented CPU allowance is 10 ms per invocation; a tiny successful rehearsal cannot establish the retained-content capacity required at launch. See [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/). Representative backup load, real Meta authentication/callbacks and crawler behavior, Images runtime, private-key retirement/reenrolment, privacy contact, DNS reconciliation and the whole-account budget remain separate launch gates.
