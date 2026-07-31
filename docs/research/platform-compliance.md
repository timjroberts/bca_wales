# UK and Welsh compliance map for the BCA platform

**Status:** Research for the Wayfinder decision ticket “Map the platform's UK and Welsh compliance obligations”  
**Current to:** 31 July 2026  
**Jurisdiction:** United Kingdom, with Welsh law and policy where devolved  
**Purpose:** Blueprint input, not case-specific legal advice

## Executive answer

The Blorenge Commoners Association (BCA) can own and operate the proposed platform, but the blueprint must treat compliance as product behaviour rather than a set of launch documents.

The minimum defensible design is:

1. BCA is explicitly recorded as controller and service provider, with a named committee-level privacy and online-safety owner.
2. A data-protection impact assessment (DPIA) is completed before field capture or emergency release goes live. It covers offline storage, geolocation, photographs, children, Facebook Login, publication, exports, collaborator access and the emergency annex.
3. Private submissions and public publications are separate records. Publication requires a moderator to create a redacted, licensed public derivative; it must not simply flip a private record's visibility.
4. The emergency annex is also separate from the canonical private plan. Moderators release only a pre-approved minimum package for a configured period, with audit, automatic expiry and cache revocation. Expiry cannot undo downloads or screenshots.
5. Every processing purpose, dataset and export has a recorded lawful basis, visibility, retention rule, licence, provenance and responsible owner.
6. The service provides privacy information, contributor terms, moderation and appeal rules, copyright/takedown reporting, data-subject rights handling, and the data-protection complaints process now required by the Data (Use and Access) Act 2025.
7. The blueprint makes an explicit Online Safety Act (OSA) scope decision before implementation. If one user's submission or collaborator comment can be encountered by another user, the service is likely a user-to-user service unless a statutory exemption applies. Premoderation alone is not a safe basis for claiming exemption.
8. The UI and generated documents target WCAG 2.2 AA in English and Welsh. Map content also has searchable/list/table and downloadable alternatives.
9. UK hosting is adopted as BCA policy, but the supplier and data-flow review still covers remote support, subprocessors and Facebook Login; server location alone does not settle international-transfer compliance.
10. Restoration proposals clearly state that platform approval is not regulatory consent. Activities on the SSSI or common may require Natural Resources Wales (NRW), Welsh Ministers, planning or other permission before physical work starts.

The largest unresolved legal decisions are the OSA classification of the exact publication/collaboration design, whether contributors under 18 will be accepted, the content and lawful basis of the unauthenticated emergency release, and BCA's legal status/authority to license members' historic material.

## Assumptions used

- BCA, not a local authority, NRW or the Fire and Rescue Service, owns and operates the service and decides its purposes.
- The platform is an information, evidence, proposal and planning service. It is not live incident command, automated fire detection, a legal register of grazing rights, a payment processor or a regulator.
- Anyone may browse public information. A Facebook-authenticated account is required to synchronise or submit field evidence or proposals.
- Initial roles are `User`, `Member` and `Moderator`; chair and secretary jointly approve formal proposals, funding applications and Fire Emergency Plan versions.
- Moderators may make a protected emergency-plan annex available without authentication for a configurable, time-limited period.
- Detailed livestock/grazing information remains private; only approved aggregates or genuinely anonymised outputs are public.
- The platform may later invite named external collaborators into narrowly shared workspaces.

If these assumptions change, the compliance assessment must be reviewed before the corresponding feature is released.

## 1. Data protection and privacy

### 1.1 Legal requirements

BCA will be a controller under the UK GDPR and Data Protection Act 2018 because it determines why and how accounts, submissions, moderation, publication and emergency sharing occur. The Data (Use and Access) Act 2025 (DUAA) amends rather than replaces the UK GDPR, DPA 2018 and Privacy and Electronic Communications Regulations (PECR); all of its data-protection and PECR provisions are now in force. [ICO: what DUAA means for organisations](https://ico.org.uk/about-the-ico/what-we-do/legislation-we-cover/data-use-and-access-act-2025/the-data-use-and-access-act-2025-what-does-it-mean-for-organisations/)

BCA must apply the data-protection principles: lawfulness, fairness and transparency; purpose limitation; minimisation; accuracy; storage limitation; security; and demonstrable accountability. [ICO: data-protection principles](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/)

That requires at least:

- a record of processing activities (ROPA). The small-organisation exemption is narrow and does not cover regular or risky processing; this platform's accounts, geolocated evidence and publication are not occasional; [ICO: who must document processing](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/documentation/who-needs-to-document-their-processing-activities/)
- a lawful basis selected and documented before each use or sharing of personal data, with an additional Article 9/DPA condition if special-category data is intentionally processed, and an Article 10/DPA condition for criminal-offence data; [ICO: lawful bases](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/)
- layered privacy information at account creation, capture, submission, collaboration, publication and emergency release explaining purposes, bases, recipients, transfers, retention and rights; [ICO: privacy information requirements](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/)
- procedures for access, rectification, erasure, restriction, objection and portability. Most rights requests must be handled without undue delay and within one calendar month, subject to limited extensions; [ICO: current subject-access guide](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/subject-access-requests/a-guide-to-subject-access/)
- a retention schedule by record class and deletion/anonymisation review. UK GDPR does not provide a universal retention period; BCA must justify its own; [ICO: storage limitation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/)
- appropriate technical and organisational security, processor due diligence and Article 28 terms. Written controller-processor contracts are a general requirement; [ICO: controller-processor contracts](https://ico.org.uk/media/for-organisations/guide-to-the-general-data-protection-regulation-gdpr/accountability-and-governance/contracts-1-0.pdf)
- a breach procedure and breach log. A breach must be reported to the ICO within 72 hours where it is likely to risk individuals' rights and freedoms, and affected people must be told without undue delay where high risk is likely; [ICO: personal-data breaches](https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/personal-data-breaches-a-guide/)
- a clear way to make a data-protection complaint, acknowledgement within 30 days, appropriate enquiries and progress updates, and an outcome without undue delay. This has no organisational exemption and has applied since 19 June 2026. [ICO: handling data-protection complaints](https://ico.org.uk/for-organisations/how-to-deal-with-data-protection-complaints/)

BCA should use the ICO fee self-assessment and is likely to need to pay the annual data-protection fee. The not-for-profit exemption is limited to processing necessary for membership/supporter administration; operating a public evidence and collaboration platform goes beyond that description. [ICO: not-for-profit fee criteria](https://ico.org.uk/for-organisations/data-protection-fee/paying-a-data-protection-fee-what-do-you-need-to-know/extraterritorial-organisations/)

### 1.2 DPIA and privacy by design

A DPIA is legally required before processing likely to create high risk. The ICO specifically identifies geolocation tracking combined with another risk criterion, matching data from multiple sources, novel technology plus another criterion, and certain processing involving vulnerable people as DPIA triggers. It also treats a DPIA as best practice more generally. [ICO: high-risk processing examples](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/examples-of-processing-likely-to-result-in-high-risk/)

Whether isolated user-selected map points technically constitute “tracking” in every case is fact-dependent. This service nevertheless combines identifiable accounts, device locations, photographs and metadata, offline persistence, public release, children who may use the service, and emergency sharing. The blueprint should therefore make a pre-launch DPIA a mandatory acceptance gate rather than rely on a narrow exemption. It must be revised before material changes such as collaborator comments, new identity providers, automated image analysis, continuous tracks or new emergency data.

The DPIA should include misuse cases: stalking or harassment from precise locations, theft associated with livestock or access points, retaliation against contributors, photographs of bystanders or children, identification through supposedly aggregated maps, loss of an offline phone, moderator abuse, compromised emergency links, and public exports being recombined with other datasets.

### 1.3 Recommended purpose/basis map

This is a blueprint recommendation to validate in the DPIA, not a substitute for BCA making and recording the actual assessment.

| Processing | Likely starting basis | Required qualification |
|---|---|---|
| Account, authentication session, terms and requested submission service | Contract and/or legitimate interests | Separate what is genuinely necessary for the user-facing service from BCA's governance interests. Do not bundle optional publication consent into the account contract. |
| Member verification and RBAC | Legitimate interests | Use a documented legitimate-interests assessment; record who granted, changed and removed privileges. |
| Private wildfire, habitat, grazing and livestock evidence | Legitimate interests | Minimise identity/location linkage and keep detailed livestock data private. Add an Article 9 condition if special-category data is deliberately collected. |
| Moderation, security and audit logs | Legitimate interests and, where applicable, legal obligation | Set finite retention; highly privileged logs need access controls and tamper evidence. |
| Publication of evidence | Legitimate interests or specific consent, depending on the material and reasonable expectations | A contributor cannot consent for identifiable bystanders. Redact faces, names, vehicle plates, exact sensitive locations and EXIF where unnecessary. |
| Invited inter-organisation collaboration | Legitimate interests; sometimes recognised legitimate interest where responding to a public body's official-function request | Determine controller/processor/joint-controller roles and make a data-sharing agreement before access. |
| Emergency sharing | Potentially the DUAA “recognised legitimate interest” emergencies condition, ordinary legitimate interests, or vital interests | The 2026 recognised-interest condition covers necessary responses to emergencies threatening serious damage to welfare or the environment. Use only what is necessary and proportionate, planned in advance and documented. [ICO: recognised legitimate interests](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/recognised-legitimate-interest/) |
| Public aggregate/export | No UK GDPR basis is needed only if the data is genuinely anonymous | Pseudonymous or merely aggregated data can remain personal data where people are reasonably identifiable. Assess re-identification and differencing risks. |

### 1.4 Facebook Login and email-based roles

Facebook Login does not transfer controller responsibility to Meta. BCA must explain the identity data it receives and why, minimise permissions, document the data flow and Meta terms, and review transfer/cookie implications. Meta says its products and business tools can collect identifiers, device/activity data and cross-border data, including in connection with Facebook Login. [Meta Privacy Policy](https://www.facebook.com/privacy/policy/?locale=en_GB), [Meta Cookies Policy](https://www.facebook.com/privacy/policies/cookies/)

PECR applies to cookies and similar storage/access technologies even where the information is not personal data. BCA must provide clear information and obtain valid consent before non-essential technologies operate; technologies essential to a service the person requested may qualify for an exception. [ICO: 2026 storage/access guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/)

Blueprint implications:

- Prefer a redirect-based login flow initiated by the user; do not load Meta social plugins, tracking pixels or SDKs on every public page.
- Store the identity provider's stable subject identifier. Do not use a mutable email address as the account's primary key.
- Treat the email list as a role-eligibility input, not proof of continuing membership. Require a moderator-approved role grant and periodic member-role review; deny by default on ambiguity.
- Record the identity provider, issuer/subject, asserted email, independent email-verification state, role source, grantor and review/expiry date.
- Provide account recovery and a planned second identity route. Facebook-only access may exclude users and creates an operational dependency; the Equality Act and general fairness make a reasonable alternative especially important.
- Do not sync evidence until authentication and submission confirmation. Before offline capture, give a concise privacy/device-risk notice and allow deletion/export of local drafts.

### 1.5 Offline PWA and geolocated media

Offline drafts stored on a phone can contain personal data even before server upload. The implementation should:

- request location and camera permission at the moment of use, explain precision and allow manual map placement;
- show what will be uploaded, including metadata, and make submission an affirmative act after authentication;
- encrypt local data where technically effective, minimise cached identity and map data, and provide “delete all local drafts”; browser storage must not be described as secure merely because the app is a PWA;
- avoid collecting continuous tracks unless a later DPIA and product decision justify them;
- strip non-required EXIF on the public derivative while retaining necessary provenance privately;
- warn about photographing people, homes, vehicles and sensitive infrastructure; and
- define conflict-safe, idempotent synchronisation so reconnecting cannot publish, duplicate or overwrite evidence silently.

### 1.6 UK hosting and international transfers

UK data residency is a sound BCA risk policy, not a general UK GDPR rule. Restricted-transfer status depends on the legal entities and access arrangements, not only the server's coordinates. Remote access by an overseas organisation can be a transfer; contracting with a UK cloud entity may not itself be a restricted transfer even if that processor uses overseas subprocessors, but BCA still has controller duties over the chain. [ICO: restricted-transfer three-step test and cloud examples](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/a-guide-to-international-transfers/are-we-making-a-restricted-transfer/)

The supplier register must therefore capture contracting entity, processing regions, support locations, subprocessors, backup locations, deletion, security and transfer mechanism. Any BCA-initiated restricted transfer needs UK adequacy, an appropriate safeguard such as the IDTA/Addendum plus the required data-protection test, or a narrowly applicable exception. [ICO: international transfers](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/)

### 1.7 Security baseline

Security must be proportionate to the consequences of exposing exact livestock, member, access and emergency information. At minimum:

- deny-by-default RBAC enforced server-side; no access decision based only on hidden UI;
- least privilege, MFA for moderators/chair/secretary, short privileged sessions and prompt role revocation;
- encryption in transit and at rest, separate secrets, patching, dependency scanning and protected backups;
- append-only audit events for moderation, formal approval, export and emergency activation, with monitored alerts for privilege changes and bulk access;
- rate limits, file type/size validation, malware scanning and safe media transcoding;
- separate private originals from redacted public derivatives and export stores;
- tested restore, incident and emergency-link revocation procedures; and
- periodic permission/access review and security test.

The ICO identifies RBAC and least privilege as appropriate encryption/security practice, while noting that encryption is contextual rather than an automatic cure. [ICO: encryption and data protection](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/security/encryption/encryption-and-data-protection/)

A statutory DPO is unlikely at the expected BCA scale because BCA is not assumed to be a public authority and is not planning large-scale systematic monitoring or large-scale special-category processing. BCA should document that conclusion and appoint a privacy owner without calling the role “DPO” unless it intends to meet the statutory independence and task requirements. [ICO: when a DPO is required](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/guide-to-accountability-and-governance/data-protection-officers/)

## 2. Children and safeguarding

### 2.1 Legal requirements

A child is anyone under 18 for these regimes. An online service need not be aimed at children for the ICO's statutory Age Appropriate Design Code to apply; it is enough that the service is likely to be accessed by children and processes their personal data. Failure to conform makes it harder to demonstrate fair, lawful processing. [ICO: status and scope of the Children's Code](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/about-this-code/)

DUAA also expressly requires an online service likely to be used by children to take children's higher-protection matters into account in privacy by design/default. [ICO: DUAA changes for organisations](https://ico.org.uk/about-the-ico/what-we-do/legislation-we-cover/data-use-and-access-act-2025/the-data-use-and-access-act-2025-what-does-it-mean-for-organisations/)

If BCA accepts a child account or a submission concerning a child, privacy information must be age-appropriate; sharing needs a compelling justification and the child's best interests; geolocation and physical-location exposure are high-risk factors. [ICO: children and the UK GDPR](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/children-and-the-uk-gdpr/)

BCA is not assumed to be a “relevant partner” with the specific section 130 statutory reporting duty placed on listed bodies/practitioners. That does not make safeguarding optional. Wales' national procedures say safeguarding is everyone's responsibility and concerns that a child is suffering or likely to be at risk must be referred to social services or police; immediate danger goes to 999. They also caution against forwarding suspected child-abuse images, including to police. [Wales Safeguarding Procedures: statutory duty explained](https://safeguarding.wales/en/chi-i/chi-i-c2/c2-p3/), [Wales practice guide: online abuse](https://safeguarding.wales/en/chi-i/chi-i-c6/c6-p6/)

### 2.2 Blueprint implications

Before launch BCA must decide between:

- **adult-only contributions**, backed by a defensible age-assurance/access approach and continued assessment of whether children nevertheless use it; or
- **child-capable contributions**, applying high privacy by default, age-appropriate notices, appropriate consent/capacity rules, no public precise location/profile by default, and moderator safeguarding training.

A terms checkbox saying “18+” is not, by itself, evidence that children cannot access the service. Public read access also means the public experience should be safe and privacy-minimal even if submissions are adult-only.

The moderation runbook needs a safeguarding route separate from ordinary rejection: preserve necessary evidence securely, restrict access, do not circulate suspected illegal imagery, escalate to the safeguarding lead/police/social services, record the decision and protect the reporter. Moderators need role-appropriate training and welfare support; the public report control must include urgent-safety guidance.

## 3. Online Safety Act and user-generated content

### 3.1 Classification is a launch-gate legal question

The OSA defines a user-to-user service broadly: an internet service that enables content generated, uploaded or shared by a user to be encountered by another user. It does not matter whether only a small proportion of the service is user-generated. The limited-functionality exemption covers narrowly described comments/reviews on provider content and reactions, not general evidence uploads or restoration proposals. [Online Safety Act explanatory notes, sections 3–4 and Schedule 1](https://www.legislation.gov.uk/ukpga/2023/50/notes/division/6/index.htm)

On the planned facts, these features can trigger scope:

- an approved user photograph/evidence item becoming visible to other public users;
- public proposals or proposal discussion;
- Member workspaces where one member sees another's submission; and
- invited collaborator comments or file sharing.

Premoderation reduces risk but does not clearly change the statutory origin of content. The Act says user-generated content is not to be treated as provider content merely because provider tools publish or control it. [Online Safety Act 2023, section 55 definitions](https://www.legislation.gov.uk/ukpga/2023/50/pdfs/ukpga_20230050_en.pdf)

A materially different design—private intake visible only to people acting for BCA, followed by BCA-authored summaries or derivative datasets—may change the analysis, but this needs specialist advice against the implemented workflow. Do not claim an exemption in the blueprint without a written feature-by-feature assessment.

### 3.2 Duties if the service is in scope

For a new regulated service, BCA must complete and record an illegal-content risk assessment within three months of launch, keep it current and reassess before significant changes. It must implement proportionate protections, explain them in terms, provide content reporting and complaints, remove illegal content swiftly when aware and retain the required records. [Ofcom: illegal-content duties](https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/illegal-content-duties-under-the-online-safety-act)

All in-scope services must complete a children's access assessment. For a new service this is due within three months. A conclusion that children are not likely to access must be evidenced and reassessed at least annually; if children are likely to access, children's risk assessment and safety duties apply. [Ofcom: children's access assessment duties](https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/childrens-access-assessment-duties-under-the-online-safety-act)

Since 7 April 2026, regulated user-to-user providers of every size must use systems and processes to report detected, previously unreported child sexual exploitation and abuse content to the National Crime Agency under the CSEA reporting regime. [Ofcom: CSEA reporting duty](https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/duty-to-report-child-sexual-exploitation-and-abuse-csea-content-know-the-rules-and-how-to-comply)

For a small, low-risk service, Ofcom still expects basic measures: understandable terms, reporting/complaints, rapid review/takedown and a named person responsible. Measures remain proportional to the risk and service design. [Ofcom: small services and the OSA](https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/helping-small-services-navigate-the-online-safety-act)

### 3.3 Blueprint implications even if exempt

Build the same low-cost safety primitives because they are also sound defamation, safeguarding and governance controls:

- versioned acceptable-use and moderation policy;
- report buttons on every public item and a route for a non-user depicted in a photograph;
- queues for illegality, safeguarding, privacy, copyright, ecological sensitivity and factual dispute;
- reason codes, evidence preservation, moderator recusal, appeal and restoration controls;
- documented response times and emergency escalation;
- blocked file types and malware/media processing; and
- records of assessment, action and policy version.

Website operators can have a defence concerning third-party defamatory statements only if they follow the statutory notice process; editorial participation and actual knowledge affect risk. BCA needs a legal/defamation complaint route rather than treating all disputes as ordinary moderation. [Ministry of Justice: Defamation Act section 5 guidance](https://www.gov.uk/government/publications/defamation-act-2013-guidance-and-faqs-on-section-5-regulations)

## 4. Accessibility and bilingual operation

### 4.1 Legal position

As a service provider to the public, BCA has Equality Act 2010 duties, including reasonable adjustments for disabled people. Government guidance confirms that this applies to all UK service providers. [GOV.UK: accessibility requirements](https://www.gov.uk/guidance/accessibility-requirements-for-public-sector-websites-and-apps)

The stricter Public Sector Bodies (Websites and Mobile Applications) Accessibility Regulations 2018 are not assumed to apply to BCA. Some charities and NGOs can fall within scope depending on public financing and whether they provide essential/public or disability-targeted services; BCA should recheck after its legal form and funding model are known. WCAG 2.2 AA and an accessibility statement are the correct engineering baseline even if the 2018 Regulations do not directly apply.

WCAG 2.2 covers keyboard operation, focus, contrast, target sizes, accessible authentication, error handling, reflow and text alternatives, among other criteria. [W3C: WCAG 2.2](https://www.w3.org/TR/WCAG22/)

Welsh Language Standards do not bind every Welsh organisation automatically. A body must be within a specified category and then receive a compliance notice setting out applicable standards. On current assumptions BCA has no such notice, so bilingual delivery is a policy commitment rather than a demonstrated statutory standards duty. [Welsh Language Commissioner: standards](https://www.welshlanguagecommissioner.wales/regulation/welsh-language-standards), [Welsh Language (Wales) Measure explanatory notes](https://www.legislation.gov.uk/mwa/2011/1/pdfs/mwaen_20110001_en.pdf)

That position should be rechecked if BCA receives substantial recurring public money, accepts functions on behalf of a standards-bound body, changes legal form or receives a compliance notice. A public body cannot avoid its own standards by outsourcing a service, so a future funded/commissioned agreement may impose bilingual contractual requirements. [Welsh Language Commissioner: third-party services](https://www.welshlanguagecommissioner.wales/resource-hub/public-organisations/delivering-services-in-welsh)

### 4.2 Blueprint implications

- Set WCAG 2.2 AA as definition-of-done for public, member, moderation, offline and emergency-release journeys.
- Publish and maintain an accessibility statement, feedback route and alternative-format process.
- Treat the map as one view. Every important feature/layer must have keyboard-reachable controls and a non-map route such as filtered records, coordinates, place/area names, tables and downloads. Government guidance notes that interactive maps are hard for assistive technology and calls for alternatives. [GOV.UK: basic accessibility check for maps](https://www.gov.uk/government/publications/doing-a-basic-accessibility-check-if-you-cant-do-a-detailed-one/doing-a-basic-accessibility-check-if-you-cant-do-a-detailed-one)
- Never encode fire condition, habitat class or approval status by colour alone; test symbology contrast and overlapping layers.
- Generate semantic, tagged and tested documents. Provide accessible HTML alongside PDF wherever practicable; start from an accessible source. [GOV.UK: accessible documents](https://www.gov.uk/guidance/publishing-accessible-documents)
- Make English and Welsh equal first-class locales in routing, translation keys, notifications, consent/terms versions and generated-document templates. Preserve Welsh names and diacritics in search, labels and exports.
- Record the language and translation status of user content. Do not present machine or community translations as the contributor's words; retain the original and provenance of each translation.
- Build workflows so a missing translation is visible and governable, not silently replaced by English. The Welsh Government's 2026 bilingual technology toolkit is a useful non-binding implementation reference. [Digital Public Services Wales: bilingual technology toolkit](https://digitalpublicservices.gov.wales/guidance-and-standards/recommended-standards/standards-catalogue/bilingual-technology-toolkit)

## 5. Copyright, database rights and data licensing

### 5.1 Legal requirements

Copyright arises automatically in photographs, text, software and original databases; the uploader does not necessarily own material they possess. Putting a work online, copying or adapting it normally requires permission or a relevant exception. [Intellectual Property Office: copyright](https://www.gov.uk/copyright), [IPO: digital photographs and the internet](https://www.gov.uk/government/publications/copyright-notice-digital-images-photographs-and-the-internet/copyright-notice-digital-images-photographs-and-the-internet)

The Open Government Licence (OGL) permits copying, publication, adaptation and commercial use of material expressly offered under it, but requires attribution and prohibits misleading endorsement. It excludes personal data and third-party rights the provider cannot license. [National Archives: Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/)

DataMapWales states that each dataset's metadata carries its licence and restrictions; some data is OGL, while restricted/licensed data may require sign-in or a separate agreement. Its terms require publishers to maintain copyright, licence, security, completeness, currency and metadata, and warn against exposing restricted or personal data in public fields. [DataMapWales: service and licensing](https://datamap.gov.wales/info/what-we-do), [DataMapWales terms](https://datamap.gov.wales/info/terms-conditions)

### 5.2 Blueprint implications

Every source dataset, document, image and derived layer needs machine-readable rights metadata:

- rights holder and contributor;
- source URL/identifier, retrieval and observation date;
- licence/version and required attribution;
- permitted display, cache, offline, derivative and export uses;
- confidentiality/access restrictions and expiry/review date; and
- derivation lineage and the licence chosen for BCA's output.

Contributor terms should leave ownership with the contributor while granting BCA a sufficiently broad, non-exclusive licence to store, reproduce, translate, redact, adapt, combine, publish, archive and sublicense approved open exports. The contributor must warrant authority to grant it and identify third-party material. A separate, explicit public-data licence choice is needed; account acceptance must not automatically place all private evidence under an open licence.

Moderation must include rights and privacy checks, not just factual quality. Provide copyright and privacy takedown routes. Do not scrape/copy online maps, reports or photographs merely because they are publicly viewable. Preserve attribution inside offline packages and exports.

## 6. Emergency-plan release

### 6.1 Legal and governance boundary

Data protection law permits necessary and proportionate emergency sharing and expects advance planning; it does not require organisations to withhold information needed to prevent serious harm. The ICO recommends identifying data, recipients and sharing arrangements in advance, considering the DPIA, and recording emergency decisions. [ICO statutory data-sharing code: emergencies](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/data-sharing-a-code-of-practice/data-sharing-in-an-urgent-situation-or-in-an-emergency/)

That does not make unrestricted publication of the entire annex lawful. An unauthenticated URL is disclosure to anyone, not only fire teams. The lawful basis, necessity and proportionality must be assessed field by field. Non-personal operational information still has security, confidence and misuse risk.

### 6.2 Required release design

Use three separate objects:

1. **Canonical controlled annex:** full version-controlled record; never public.
2. **Approved emergency release package:** a chair/secretary-approved snapshot containing only data pre-cleared for unauthenticated emergency release.
3. **Activation event:** moderator, reason/incident, package version, configured start/expiry, resulting URL/state and audit record.

The package should exclude personal phone numbers where an organisational contact works, domestic addresses, unneeded member/livestock detail, secrets and information whose public value does not outweigh misuse. It should show plan version, owner, approval date, activation time, expiry, emergency disclaimer and contact route. The public endpoint must automatically stop serving it, purge caches/CDNs, use appropriate cache controls and resist indexing. A secret URL is not access control, and expiry cannot retract a downloaded copy.

The release workflow should require a positive confirmation of the selected package and duration, alert other moderators/chair/secretary, allow immediate revocation, and create an offline/print package at the same time. Failed expiry or cache purge should alert an operator. Activation, access telemetry if collected, revocation and post-incident review need proportionate retention.

Before production, agree the information design and sharing protocol with South Wales Fire and Rescue Service and conduct a tabletop test. The plan must state that it is reference material, not command/dispatch/crew tracking and not a substitute for current operational judgement.

## 7. Environmental, common-land and information-law boundaries

The platform can develop a proposal but cannot authorise work. NRW says owners/occupiers must notify it and obtain consent before carrying out or allowing an operation on an SSSI's potentially damaging operations list, subject to stated exceptions; emergency works must be reported as soon as possible. [NRW: SSSI owner/occupier responsibilities](https://naturalresources.wales/guidance-and-advice/environmental-topics/land-management/guidance-for-sssi-land-owners-and-occupiers/?lang=en)

Restricted works on Welsh common land require Welsh Ministers' consent under section 38 of the Commons Act 2006 unless an exemption applies. [Law Wales: common land](https://law.gov.wales/environment/countryside-and-access/common-land)

Blueprint requirements for every formal proposal:

- authoritative boundary intersection and designation snapshot;
- list of potentially applicable consents/permissions and their status;
- landowner/occupier/common-right and delivery-authority fields;
- explicit “platform/BCA approval is not regulatory consent” state;
- attachments/export suitable for NRW and other authority review; and
- no transition to “ready to deliver” until the responsible person records required permission or a reason it is not required.

The Freedom of Information Act 2000 and Environmental Information Regulations 2004 generally bind public authorities; BCA is not assumed to be one. [Law Wales: freedom of information](https://law.gov.wales/constitution-and-government/public-administration/freedom-information) However, information BCA holds on behalf of a public authority, or shares into that authority's decision-making, may be reachable through that body's information-access obligations. Collaboration/data-sharing agreements must say who owns the record, whether BCA holds it on another body's behalf, who handles requests, and what confidentiality caveats are realistic. “Confidential” is not a promise that a public authority can always withhold information.

The new Environment (Principles, Governance and Biodiversity Targets) (Wales) Act 2026 primarily imposes duties on Welsh Ministers, NRW and specified public authorities, not BCA on current assumptions. It is nevertheless relevant context for the evidence public partners may need and for future funding criteria. [Law Wales: 2026 environmental governance Act](https://law.gov.wales/environment-principles-governance-and-biodiversity-targets-wales-act-2026)

## 8. Records, evidence and governance

### 8.1 Legal minimum and strong recommendation

There is no single statutory retention period or universal legal chain-of-custody standard for all ecological observations. UK GDPR still requires accuracy, storage limitation, security and rights handling where records identify people. Formal submissions, approvals and emergency versions also need enough authenticity to be relied upon.

The platform should therefore use an evidence model that records:

- immutable submission identifier and original file hash;
- creator/account, capture and upload time, location source/accuracy and device-reported time;
- original file, extracted metadata and every redacted/translated/derived version;
- factual status (`reported`, `corroborated`, `disputed`, `superseded`) separate from moderation/publication status;
- source, licence, consent/privacy flags and ecological sensitivity;
- moderation decisions, reasons, actor and policy version;
- formal chair and secretary approvals as two distinct events; and
- export contents, version, generator, time and checksum.

Corrections should supersede rather than silently overwrite a formal record. Audit does not mean retain every identifier forever: apply the retention schedule, separate durable ecological facts from contributor identity, and anonymise/archive where justified. A public export should be reproducible from a recorded snapshot.

External collaborators need object-scoped invitations, expiry, least privilege, organisational affiliation and clear controller status. Do not introduce a global `Collaborator` role that can browse the whole Member workspace merely because it is simpler to code.

### 8.2 Required policy set

Keep policies version-controlled alongside the application and bind accepted versions to accounts/actions:

- privacy notice and ROPA;
- DPIA and legitimate-interest assessments;
- cookie/storage notice and consent record;
- contributor terms and content/data licence;
- acceptable use, moderation, appeal, safeguarding and takedown procedures;
- data-subject rights and data-protection complaints procedure;
- retention/deletion and records policy;
- incident/breach response;
- external collaboration/data-sharing agreement template;
- emergency release procedure; and
- accessibility statement and bilingual content policy.

## 9. Public fundraising and external providers

Using an external fundraising provider removes BCA from card processing and should keep card data out of BCA systems, but it does not remove responsibility for BCA's campaign claims, supporter data it receives, embedded cookies or data sharing. The blueprint should prefer ordinary links or provider-hosted checkout over embedded payment widgets, state clearly that payment occurs on the provider's site, and import only information BCA has a documented purpose and basis to use.

Do not advertise a restoration intervention as approved where environmental or land consent is outstanding. Record campaign owner, approved wording, evidence for claims, external provider, privacy roles, target/use of funds, end state and archival record. Fundraising campaigns and payment records remain out of the platform's own transaction model.

## 10. Blueprint acceptance gates

| Gate | Evidence required before release |
|---|---|
| Organisational identity | BCA legal name/status, controller address/contact, chair/secretary authority and ICO fee outcome recorded. |
| Data inventory | ROPA, data-flow diagram, processor/subprocessor and transfer register, retention schedule. |
| Risk | Approved DPIA with residual risks and owners; specialist consultation with ICO if an unmitigated high risk remains. |
| Identity/RBAC | Threat model; stable provider ID; email/member verification and review; MFA for privileged roles; tested revocation. |
| Public intake | Contributor terms/licence, just-in-time notice, local-draft controls, moderation/safeguarding/takedown flows. |
| Online safety | Written OSA scope opinion; if in scope, illegal-content and child-access assessment plan, terms/reporting/complaints and CSEA process. |
| Publication/export | Private-to-public derivative workflow; privacy, ecological sensitivity and licence checks; re-identification test; attribution manifest. |
| Collaboration | Scoped invitation model and controller/data-sharing terms. |
| Emergency annex | Approved minimum package schema, lawful-basis assessment, SWFRS review, activation/revocation/cache tests and tabletop exercise. |
| Accessibility/language | WCAG 2.2 AA test including auth/offline/map alternatives; accessible HTML/document output; English/Welsh parity checklist and statement. |
| Environmental proposals | Consent-status model and regulatory disclaimer; no workflow that presents BCA approval as permission to carry out works. |
| Operations | Restore test, incident/breach exercise, rights and complaint rehearsal, moderator training and named owners. |

## 11. Matters requiring specialist legal advice

These cannot responsibly be settled by general research alone:

1. **OSA scope:** obtain an opinion on the exact user-to-user, moderator and collaborator flows and any limited-functionality/internal-service exemption before build choices are locked.
2. **Contributors under 18:** decide the allowed age, age assurance, capacity/parental-consent approach, Children's Code implementation and Welsh safeguarding procedure.
3. **Emergency package:** review its actual schema, public-access method, recognised-legitimate-interest/vital-interest analysis, contacts, sensitive infrastructure and liability wording with data-protection counsel and SWFRS.
4. **BCA legal form and authority:** confirm who is the controller/service provider and who can grant licences, contract with processors and accept liability if BCA is an unincorporated association.
5. **Historic member records:** determine copyright, confidentiality, privacy and land-right restrictions before import; physical possession is not ownership or permission.
6. **External collaboration:** determine controller, joint-controller or processor status per organisation/workflow and whether records are held on behalf of a public authority for FOI/EIR purposes.
7. **Reliance and professional liability:** review disclaimers, insurance and governance for emergency and restoration material used by third parties.

## 12. Newly visible blueprint decisions

The research makes the following decisions sharp enough for separate Wayfinder tickets:

1. **Choose the OSA/content architecture:** will the system support user-to-user publication/discussion and meet OSA duties, or deliberately use private intake followed by BCA-authored public derivatives and tightly constrained collaboration?
2. **Set the contributor age model:** adult-only contribution with effective enforcement, or child-capable service designed to the Children's Code and safeguarding requirements?
3. **Define the emergency release schema and authority:** which exact fields may be unauthenticated, under what lawful basis, who pre-approves the package, and what activation/revocation tests are mandatory?
4. **Define identity and membership proof:** how will Facebook identity, verified email, manual BCA membership, role review, recovery and a future second provider interact?
5. **Define public derivative and licensing rules:** what is redacted/generalised, what retains provenance privately, which contributor licence applies, and which outputs may receive an open licence?
6. **Determine BCA legal identity and data-protection ownership:** what legal form contracts, controls data, pays the ICO fee and bears operational liability?

## Primary-source index

The links above point only to legislation, regulators, official Welsh/UK government sources, W3C standards and Meta's own policies. Particularly time-sensitive conclusions—the DUAA complaints duty, OSA/CSEA duties, 2026 Welsh environmental Act and cookie guidance—were checked against sources current on 31 July 2026.
