# Facebook identity and stateless session feasibility

Research date: 2026-09-08. Research only; no implementation or deployment.

Question: [Establish Facebook identity and stateless session feasibility](https://github.com/timjroberts/bca_wales/issues/99), under [Design the BCA Wales blog for implementation review](https://github.com/timjroberts/bca_wales/issues/98). Branch: `research/blog-facebook`, based on `cefb1bd`. Repository instructions and the research skill were read; this research subagent performed the investigation itself as instructed. Only this artifact changes.

## Result and evidence boundaries

**Feasible, with qualifications:** a Worker can validate Facebook Login, retrieve permitted identity fields, discard the user access token and issue its own authenticated, optionally encrypted HttpOnly cookie. A database of everyone who logs in is not intrinsically necessary. This is an architectural inference from Meta's server-side flow and Workers' cryptographic capabilities, not a Meta-approved reference implementation. App credentials and session keys still persist as secrets. Immediate per-person revocation, strict one-time OAuth transactions and deletion processing introduce small amounts of state even if there is no user-account table. [Meta manual flow][M1]; [Workers Web Crypto][C1].

**Do not promise a publicly resolvable profile link.** Meta explicitly restricts the returned User `link` to viewers who are logged into Facebook and are friends of that person. Its `id` is app-scoped, not a public-profile locator. Picture URLs expire. Email can be declined or absent. [User reference][M2]; [picture reference][M4]; [manual flow][M1].

Evidence labels used below:

- **Verified documentation:** primary source retrieved on the research date; this is a documentation fact, not a production test.
- **Proposed approach/inference:** application design derived from the evidence; no policy is selected here.
- **Live validation:** facts dependent on the actual Meta app, permission approval, selected Graph version or browser/account combination.

Meta initially returned HTTP 429/fetch failures to the web reader. Direct HTTPS retrieval subsequently succeeded for the manual flow, User, permissions, access levels, picture, deletion, security, debug-token, business verification, App Review and authentication/data-access references. `/policy/` returned the readable Platform Terms; `/legal/terms/platform` returned only a Facebook shell. Thus the core provider findings below were actually read from Meta, rather than inferred from search snippets. The authenticated app dashboard and live account/API behavior were not inspected. No production credentials or user tokens were requested. Sources mix legacy App Type terminology and newer documentation paths; the User/picture references displayed v26.0 while the manual-flow examples used v25.0. Neither is a reason to assume the app's configured API version.

## Identity fields and public-app access

| Data | Verified provider contract | Consequence / fallback |
| --- | --- | --- |
| Stable provider identity | User `id` is an app-scoped numeric **string**, unique to the app and unusable as another app's ID. Included in default public profile. [M2] | Use `(provider=facebook, app_id, subject=id)` as the identity key. Preserve as a string. Do not key identity by name/email or construct `facebook.com/<id>` / `profile.php?id=<id>`. App changes require an explicit migration plan. |
| Name | `name` and name components are default `public_profile` fields. This permission is automatically granted and cannot be declined independently in the Login dialog. [M1][M2][M3] | It is a display attribute, not proof of a legal name or uniqueness. Copy a provider-validated snapshot when content is submitted; escape on rendering. Handle malformed/missing display data with a neutral label, or require retry if the human chooses that policy. |
| Picture | Included among default public-profile fields. The separate picture edge documents no extra permission and tokenless ASID reads; ordinary UID reads require tokens. [M2][M4] | Not guaranteed to be a permanent image or a non-silhouette portrait. Provide a neutral avatar. Do not expose tokens in image URLs. |
| Email | `email` permission reads the primary email; User `email` is omitted when no valid email is available. Users can decline optional permissions; `/me/permissions` reports grants/declines. [M1][M2][M3] | Treat missing, empty and declined email as normal states. Requesting the scope is not evidence of a returned address. Do not invent an address or equate successful Facebook authentication with possession of an allowlisted mailbox. |
| Clickable Facebook profile | `user_link` permits obtaining the person's Facebook profile URL; its allowed use is letting app users visit another person's profile. User `link` only resolves for a logged-in Facebook friend. [M2][M3] | Request `link` only with the approved permission. Even a returned URL cannot satisfy an unconditional public-reader promise. Use a plain name if unavailable; optionally label a returned link as opening Facebook with access dependent on Facebook. |

`public_profile` supports authentication and personalization. `email` supports communication and login using the Facebook-associated email. These purposes do not automatically approve every form of public redistribution of attribution. The user's proposed storage is a design requirement, not a substitute for contributor consent and Meta's sharing terms. [Permissions][M3]; [Platform Terms §§3–4][M10].

### Review and operational prerequisites

**Verified, but reconcile the actual app dashboard before launch:**

1. The Access Levels page explicitly applies to apps created using an **App Type**. Standard Access serves app-role users; Advanced Access serves non-role users. Its Consumer-app section says `email` and `public_profile` receive automatic Advanced approval but start at Standard and must be switched; Consumer apps must also be Live. Advanced access requires business verification, and annual Data Use Checkup applies. This is not proof that a newly created app with a different use-case flow has identical controls. [M5]
2. The authentication/data-access page says default name/photo and email can be requested without App Review, while other permissions require it. The general App Review page says public non-role access must undergo review. Read these as a basic-permission exception plus access/publishing requirements, **not** as a guarantee that every public app needs a bespoke email review or that basic login bypasses all approval. `user_link` is outside the basic exception: plan for permission review, justification and a reviewer-accessible demonstration. No review success is guaranteed. [M6][M7]
3. Business Verification is a separate process. Meta says apps seeking Advanced Access must connect to a verified business; an app administrator can connect it but a business administrator completes verification. Validate the BCA operator's eligibility and exact dashboard requirements before committing to Facebook-only participation. [M8]
4. Configure the Facebook website login product/use case, app identity/domain, a canonical HTTPS website and exact callback allowlist; enable the OAuth flows actually used. Strict redirect matching and HTTPS are required. Keep the app secret server-side; the JS SDK is not required for the manual server flow. App settings expose domain and flow restrictions. [M1][M9]
5. Publish an accessible privacy policy describing data, purposes and deletion; register its URL. Specify deletion instructions or a deletion callback URL; if using a callback it must be HTTPS and return the documented status URL and confirmation code. Maintain the process after launch. [M10][M11]

**Launch gate, not completed research work:** use a real non-role account against the intended app/version, including declined/no-valid email, picture silhouette/error, `user_link` granted/declined and friend/non-friend/logged-out link viewers. Record the actual business verification, access, review, publishing and Data Use Checkup requirements. Do not mistake a developer/tester's successful login for public availability.

## Worker session: source-backed requirements and proposed construction

### Callback and provider validation

**Verified requirements:** Meta documents `response_type=code`, server-to-server code exchange using the app secret and the original redirect URI, `state`, token inspection and permission checks. Its security guide requires exact redirect matching, recommends signing server Graph requests with `appsecret_proof`, and warns not to assume a token belongs to this app. `debug_token` exposes `app_id`, `user_id`, `is_valid`, `expires_at`, `data_access_expires_at` and scopes. [M1][M9][M12]

**Proposed acceptance sequence:**

1. Begin from a deliberate login action. Generate a cryptographically random transaction nonce; bind it to the browser, expected Facebook app, exact callback, creation/expiry time and an allowlisted local return path. Use a separate short-lived `__Host-` HttpOnly Secure SameSite=Lax transaction cookie so a normal cross-site top-level GET callback can carry it.
2. On the callback require the matching browser transaction and state, reject missing/duplicate/malformed parameters, cancellation/errors, expiration and reuse. Do not authenticate from query-string identity fields, a supplied email, a frontend assertion or the existence of either cookie.
3. Exchange the code only at the fixed Meta endpoint over HTTPS with server credentials. Inspect the returned token server-side; require validity, the configured app ID, a nonempty user subject, correct token context and acceptable expiration. Fetch `/me` with explicit permitted fields and require its ID to equal the inspected subject. Check actual scopes rather than requested ones; absent optional data must not silently confer privileges. Reject ambiguous/error responses.
4. Create a fresh local session only after those checks, discard the user token after the callback's required API calls, and clear the transaction. Redirect to a clean local URL. Exclude callback query strings, cookies, app secrets and tokens from logs; return `Cache-Control: no-store` on authentication and private responses. Do not place credentials in public content or R2 assets.

OAuth Security BCP requires browser-bound one-time state unless a supported PKCE/OIDC protection is used, exact redirect matching, and prevention of code injection. PKCE S256 is recommended for confidential clients. **Meta PKCE support for this exact website flow was not established**: the inspected manual-flow/security pages did not document it. Do not claim unsupported parameters provide protection. [RFC 9700 §§2.1, 4.5, 4.7][S1]

**State consequence:** a protected browser cookie can carry transaction details, but deletion of that cookie is not a server-side proof against replay of a copied transaction. To satisfy strict one-time consumption, use a short-lived, atomically consumed nonce record (not a user-account database), or validate an explicitly supported equivalent with a security review. Authorization codes must themselves be single-use under OAuth, but that alone does not make reusable application state one-time. [RFC 6749 §4.1.2][S2]. A wholly storage-free OAuth implementation is therefore not established by this research.

### Signing, encryption and validation

Workers supports AES-GCM, HMAC, random generation and Web Crypto operations; secrets are encrypted bindings intended for API keys and authentication tokens. Store Meta credentials and independent session/transaction keys there, not in repository variables or client bundles. [C1][C2]

Signing/MAC protects integrity and authenticity, **not confidentiality**. A signed JWT containing email remains readable to anyone holding it. Authenticated encryption (for example a reviewed AES-GCM-based format) also conceals identity values; encryption without authentication is insufficient. Use a maintained, Workers-compatible construction, not a new cryptographic protocol. GCM nonces must not repeat for a key; apply the chosen library's nonce/key usage limits. [JWT][S3]; [OWASP cryptographic storage][S4]

**Proposed minimal protected claims:** format/version, local issuer/audience, provider and app ID, string subject, original authentication time, issued-at, absolute expiry and a session nonce. Include only needed display snapshots/optional email within cookie limits; never a reusable Facebook user token. Validate cryptography **before** trusting fields, then enforce schema, purpose, issuer/audience, times and accepted key version on every protected request. Pin allowed algorithms and keys; reject `none`, unknown key IDs and cross-purpose tokens. An arbitrary cookie named `session` is not authenticated; a valid local token only proves the site issued that session after the recorded validation. [S3][JWT BCP][S5]

**Proposed rotation:** issue under one active key ID; temporarily accept a bounded previous set for no longer than the maximum session lifetime plus clock tolerance. Keep separate key purposes. Retire compromised keys immediately, accepting global logout; rotating only the issuance key while still accepting the compromised key does not revoke stolen sessions. Routine rotation interval and emergency ownership are human/operational choices. [S4][S5]

### Cookie, expiry, logout and authorization limits

| Concern | Requirement / consequence |
| --- | --- |
| Cookie transport | `__Host-…; Secure; HttpOnly; Path=/; SameSite=Lax` is a viable proposed baseline with **no Domain attribute**. Lax permits a cross-site top-level safe-method navigation. Strict may suit the application session separately; test login/navigation UX. Host-only scope means `bca.wales` and `www.bca.wales` do not share a session: choose a canonical origin and redirect the other. [Cookie reference][S6] |
| Expiry | Enforce the authenticated absolute expiry server-side regardless of browser retention; Max-Age is not validation. A browser session cookie may survive session restore. Do not extend the original authentication indefinitely by resealing on each request. True global idle timeout needs shared last-activity state; a copied older cookie remains usable until its own cutoff. [S3][S6]; inference from self-contained tokens. |
| Provider freshness | Meta says non-SDK integrations should check token validity at least daily because security events can expire tokens early. Authentication/data access have distinct expiry semantics. Without a retained token or renewed login, a local cookie cannot perform that check or learn provider-side changes. [M6][M9] |
| No-token approach | **Proposed conservative option:** require fresh provider validation at a chosen short absolute interval, shorter than the documented daily check cadence, and no later than applicable returned token/data expiry when relying on fetched data. This reduces exposure but does not establish immediate revocation or provider endorsement of the exact local-session scheme. Longer sessions require resolving how provider checks are performed. No 60/90-day local lifetime is implied. |
| Logout | CSRF-protected local logout deletes the cookie with matching scope and expires it. It does not log out of Facebook or revoke the app grant. A stolen copy remains valid until expiry/key retirement unless a server revocation check rejects it. Per-session logout everywhere needs a denylist/session record; per-person invalidation can use a `revoked_before` timestamp or generation. [M1]; [OWASP sessions][S7]; design inference. |
| Theft / XSS | Encryption cannot prevent replay of stolen ciphertext. HttpOnly reduces script access to the cookie but XSS can still send authenticated writes. Cookie theft grants the session's current authority until expiry or revocation. [S7] |
| Write CSRF | Protect every mutation (including logout) with origin validation plus a CSRF mechanism, e.g. a signed double-submit token tied to the protected session nonce and sent in a custom header. Do not expose the HttpOnly cookie itself. Reject unsafe cross-origin requests; constrain credentialed CORS. SameSite alone is defense in depth; sibling subdomains may be same-site. Never mutate on GET. [OWASP CSRF][S8] |
| Write authorization | Validate session and current policy in the Worker on **every** comment/post/upload/publish/moderation mutation; deny by default. Authenticated commenters are not administrators. Per the map, current allowlisted administrators can manage all posts. Do not trust a cookie's cached `admin=true`, hidden UI, caller-supplied attribution or object IDs as authority. [OWASP authorization][S9] |
| Allowlist removal | Look up current allowlist membership for each administrative write. Removal revokes admin rights when the new policy is visible, even if the session remains authenticated. It does not revoke commenting or erase attribution. If stored in KV, updates may take 60 seconds or more to propagate; do not promise immediate removal. An authoritative strongly consistent check is needed for an immediate guarantee. [C3]; proposed consequence. |

**Email allowlisting remains a human decision.** If chosen, missing/ungranted email denies administrator access, and a returned address is a snapshot, not a stable identity or a general `email_verified` assertion. Never accept a manually supplied matching address as Facebook evidence. Options are explicit enrollment of an app-scoped ID, an email-based bootstrap followed by binding to that ID, or continued email matching with a separately agreed verification/freshness policy. Account/mailbox changes and rebinding need an operator process. None is selected here.

## Attribution, longevity and deletion

**Verified:** the picture edge normally redirects to an image; returned image URLs expire. Tokenless ASID requests fail for inactive apps or incomplete Data Use Checkup, and Development-mode tokenless requests return a silhouette. Therefore a saved CDN URL is not a durable asset. Re-querying the documented picture edge is a possible refresh mechanism without stored user tokens, but its availability is conditional. [M4]

**Proposed presentation options:**

- Name snapshot plus neutral avatar and no link: least external availability dependency.
- Provider name plus the actual returned `link`, opening a new tab with `noopener noreferrer`; fallback to plain text when absent. Communicate the Facebook viewer restriction rather than asserting every reader can visit.
- A tokenless ASID picture-edge reference, or refreshed image URL, with a neutral-avatar failure fallback. Direct browser requests disclose network/referrer context to Meta and may expose ASIDs; a controlled proxy reduces direct third-party requests but adds caching/deletion work. Do not proxy arbitrary user-supplied URLs.
- Copying pictures into site storage improves technical longevity but expands personal-data storage, consent and purge responsibilities; it is not automatically authorized by having login permission. Optional user-supplied links are possible only as a separate unverified field with validation/moderation, not as proof of Facebook identity. Do not scrape profiles or reverse-engineer IDs.

The user chooses whether attribution is a historical snapshot or refreshed on later login, whether old posts change after a rename, and whether images/links are worth the operational dependency. Missing email need not block commenting if the human accepts stable-ID authentication. Missing subject or failed provider validation must block authenticated writes.

### Provider obligations

Meta's Platform Terms require an accessible modification/deletion route, prompt updates/deletion on request, deletion when data is no longer needed or the service stops, and deletion when the user requests it or no longer has an account, subject to the terms' specified exceptions. Public sharing requires a permitted basis; express user direction/consent is one such route and proof must be retained. The privacy policy must describe processing and deletion. IDs, names/profile identifiers, email, pictures and derived data are not exempt merely because they are stored next to a comment rather than in a users table. [M10 §§3.c–d, 4, 12]

Meta's deletion callback receives a signed POST containing the app-scoped user ID. Its implementation must initiate deletion and return a status URL plus alphanumeric confirmation code. The example verifies HMAC-SHA256 with the app secret. Either a deletion-instructions URL or callback URL can be supplied in app settings; the documentation also describes downloadable deletion-ID requests in the dashboard. A workflow needs an owner even if callback automation is deferred. [M11]

Meta also documents a deauthorization callback when people uninstall the app. **Deauthorization, an explicit data-deletion request, local logout, and Facebook account deletion are different events.** Do not promise that all account deletions instantly reach the Worker. Verify the actual deauthorization payload/signature, retries and timing; its wire contract was not independently exercised. Authenticate callbacks before acting; process retries idempotently. Without revocation state, even a received callback cannot invalidate a copied local cookie selectively. [M1][M11]; architectural inference.

### Minimal persistence without a user-account database

**Proposed minimum for attribution lookup:** every post/comment's private metadata stores the app ID and subject, or a deterministic keyed subject tag such as `HMAC(mapping_key, provider || app_id || subject)` with an unambiguous encoding and key version. The public representation omits that lookup key and email. Callback subject → matching objects can be a scan for a small corpus or a subject-to-object index for scale. Names/photo/link alone cannot reliably correlate a deletion request containing only an ASID. This mapping concerns contributors who created content, not everyone who ever logged in.

A hash/tag is still linkable personal/provider-derived data, not an erasure or anonymization loophole. Mapping-key rotation must preserve the ability to locate existing objects. If keying per-object randomly, an additional durable subject-to-object index is necessary. The user has permitted name/picture/link storage; the extra private subject mapping must be explicitly agreed in the design.

Other possible state has separate purposes:

| Record | When needed |
| --- | --- |
| Short-lived OAuth nonce and consumption state | Strict one-time transaction acceptance, unless a verified equivalent is chosen. |
| Current administrator allowlist | Always for the agreed administrator policy; not a full user table. |
| Session denylist or subject generation/revocation cutoff | Selective immediate logout/deauthorization, bans, or prevention of writes after a deletion request. A global key cutoff is an alternative with global impact. |
| Deletion request ID/status, processing receipt | Reliable callback acknowledgement, retries, status reporting and recovery. Minimize retained identifying data and agree retention. |
| Contributor direction/consent record | Evidence for public sharing; can sit alongside content with notice version/time. |

**Proposed deletion scope:** locate attribution in draft/published posts, comments (including administratively hidden originals), indexes, cached/preprocessed HTML/JSON, copied avatars, revisions and backups. Remove or appropriately de-identify the relevant provider data and republish/purge public derivatives. Ensure a still-valid old cookie cannot immediately recreate erased attribution: invalidate relevant sessions or require fresh login with an authoritative deletion/revocation check. Define an interruption/retry strategy so a failed purge is not reported complete.

Whether authored text is deleted, kept with removed attribution, or retained under a specific justified exception is a human policy/legal decision; the callback's provider-data requirement does not by itself resolve every user-generated-content question. Hiding a comment is reversible moderation, **not deletion**. Do not claim a display label of “Deleted user” anonymizes text that still identifies the person.

## Decisions and prerequisites to return to the parent

The research question is adequately answered for planning, with provider documentation and explicit uncertainty. It does **not** certify an operational Meta app or select these policies:

1. Stable app-scoped ID versus email-based administrator enrollment, missing-email UX and how operators enroll/rebind administrators.
2. Acceptance of friend-only Facebook links versus plain names; image reference/copy/neutral avatar; snapshot versus refresh behavior and contributor consent.
3. Session absolute lifetime, reauthentication frequency, signing versus authenticated encryption, acceptable stolen-cookie/revocation window, and immediate logout/bans/deauthorization requirements.
4. Permission to store the private subject-to-content mapping and minimal nonce/revocation/deletion records, without a general account database.
5. Erasure/retention behavior for authored text, provider attribution, hidden comments, backups and public derivatives.

**Suggested prerequisite for the parent:** a bounded “Validate the production Meta app's public login, fields and lifecycle callbacks” task before implementation commitment/launch. It should capture actual dashboard requirements and evidence from non-role accounts; test missing email, `user_link` viewer restrictions, tokenless pictures, code/state replay defenses, token expiry/revocation, deauthorization and deletion status handling; establish PKCE/code-injection protection for the selected flow. Do not create tickets or edit the map from this branch. Existing identity/session and comments decision tickets can absorb the policy choices; no new architecture implementation is authorized.

## Primary sources

All retrieved 2026-09-08. Meta sources were read via direct HTTPS after web-reader failures. Older code/news/search results were not used to establish current provider contracts.

[M1]: https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/ "Meta: Manually Build a Login Flow"
[M2]: https://developers.facebook.com/docs/graph-api/reference/user/ "Meta: User reference (displayed v26.0)"
[M3]: https://developers.facebook.com/docs/permissions/ "Meta: Permissions Reference"
[M4]: https://developers.facebook.com/docs/graph-api/reference/user/picture/ "Meta: User Picture (displayed v26.0)"
[M5]: https://developers.facebook.com/docs/graph-api/overview/access-levels/ "Meta: Access Levels (App Type scope)"
[M6]: https://developers.facebook.com/documentation/facebook-login/auth-vs-data "Meta: Authentication Versus Data Access"
[M7]: https://developers.facebook.com/docs/app-review/ "Meta: App Review"
[M8]: https://developers.facebook.com/docs/development/release/business-verification/ "Meta: Business Verification"
[M9]: https://developers.facebook.com/docs/facebook-login/security/ "Meta: Login Security"
[M10]: https://developers.facebook.com/policy/ "Meta: Platform Terms (retrieved through /policy/)"
[M11]: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/ "Meta: Data Deletion Request Callback"
[M12]: https://developers.facebook.com/docs/graph-api/reference/debug_token/ "Meta: Debug Token"
[C1]: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/ "Cloudflare: Web Crypto"
[C2]: https://developers.cloudflare.com/workers/configuration/secrets/ "Cloudflare: Secrets"
[C3]: https://developers.cloudflare.com/kv/concepts/how-kv-works/ "Cloudflare: KV consistency"
[S1]: https://datatracker.ietf.org/doc/html/rfc9700 "IETF RFC 9700: OAuth Security BCP"
[S2]: https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.2 "IETF RFC 6749: Authorization response"
[S3]: https://datatracker.ietf.org/doc/html/rfc7519 "IETF RFC 7519: JWT and registered claims"
[S4]: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html "OWASP: Cryptographic Storage"
[S5]: https://datatracker.ietf.org/doc/html/rfc8725 "IETF RFC 8725: JWT BCP"
[S6]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie "MDN: Set-Cookie"
[S7]: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html "OWASP: Session Management"
[S8]: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html "OWASP: CSRF Prevention"
[S9]: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html "OWASP: Authorization"
