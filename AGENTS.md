# Repository agent instructions

## Issue tracker

Use GitHub Issues in `timjroberts/bca_wales` for planning and decision tracking. Use the authenticated GitHub CLI (`gh`) from this repository. Do not create a local-Markdown tracker.

## Wayfinding operations

Wayfinder maps and tickets use GitHub's native issue relationships:

- A map is an issue labelled `wayfinder:map`.
- Every decision ticket is a native sub-issue of its map and has exactly one type label: `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
- Native `blocked by` relationships define ordering. Do not encode dependencies only in issue bodies.
- Assignment is the claim. An open, unassigned ticket is unclaimed.
- In user-facing text, refer to issues by their linked titles, never by bare issue numbers.

### Discover and load a map

Find maps with:

```sh
gh issue list --label wayfinder:map --state all --json number,title,state,url
```

Load only the selected map's low-resolution view first:

```sh
gh issue view MAP --json number,title,body,state,url,subIssues
```

Fetch a ticket's full body or comments only when resolving or consulting it.

### Create a map and tickets

Create the map first:

```sh
gh issue create --title "MAP TITLE" --label wayfinder:map --body-file MAP_BODY
```

Create all currently specifiable tickets as native children in a first pass:

```sh
gh issue create --title "TICKET TITLE" --label wayfinder:TYPE --parent MAP --body-file TICKET_BODY
```

After every ticket has an issue number, wire dependencies in a second pass. The dependent ticket is the one being edited:

```sh
gh issue edit DEPENDENT --add-blocked-by BLOCKER
```

### Find the frontier and claim a ticket

Start from the map's open sub-issues:

```sh
gh issue view MAP --json subIssues --jq '.subIssues.nodes[] | select(.state == "OPEN") | [.number, .title] | @tsv'
```

For each candidate in map order, inspect its claim and dependencies:

```sh
gh issue view TICKET --json assignees,blockedBy,state,title,url
```

A frontier ticket is open, has no assignees, and has no open issue in `blockedBy`. Claim the first frontier ticket before doing any work:

```sh
gh issue edit TICKET --add-assignee @me
```

### Resolve a ticket

Post the complete answer as a resolution comment, then close the ticket:

```sh
gh issue comment TICKET --body-file RESOLUTION
gh issue close TICKET --reason completed
```

Update the map body so `Decisions so far` gains one linked-title gist pointing to the resolved ticket. Create newly visible tickets before wiring their dependency relationships. Remove graduated material from `Not yet specified`; record mis-scoped closed tickets under `Out of scope`, not `Decisions so far`.

Research tickets may additionally link a repository research artifact and its branch or commit from the resolution comment.
