# Contributing

Maschina has no licence yet, so outside contributions can't be accepted until one is chosen. This
file describes how work is done in the repository.

## Setup

```bash
pnpm install
pnpm bootstrap
pnpm check:machine
```

## Branches

Branch from the latest `main`. Names are a type, a slash, and one to three short words:

```text
feat/machine-list
fix/login-redirect
chore/deps
```

Shorter is better. CI refuses anything longer or differently shaped.

### Building on a branch that hasn't merged yet

You don't have to wait for a pull request to merge before starting the next piece of work.

- **Work that doesn't depend on the open pull request:** branch from the latest `main` as usual.
- **Work that does depend on it:** start a stacked branch from the unmerged one. Its pull request
  targets the unmerged branch.

  ```bash
  pnpm stack feat/second-part
  gh pr create --fill --base feat/first-part
  ```

- **After the first pull request merges:** run `pnpm restack` on the stacked branch. GitHub points its
  pull request at `main` by itself.

`pnpm restack` moves the current branch onto the latest version of what it was built on, and pushes
it. Once that branch has merged, it moves onto `main`. It replays only the branch's own commits, so a
squash merge underneath it doesn't cause conflicts. If a real conflict comes up, fix it, run
`git rebase --continue`, and run `pnpm restack` again.

## Pull requests

- One change per pull request, linked to the issue it closes with `Closes #123`.
- Turn on auto-merge when you open it (`gh pr merge --auto --squash`). It merges itself once checks
  pass, so there's nothing to wait for.
- The title is a conventional commit and becomes the commit on `main` when it is squash merged. It is
  also the line that appears in the changelog, so write it for someone reading release notes.

## Commits

Conventional commits, one line, no body:

```text
feat(gateway): add machine list endpoint
fix(rules): stop reservation rounding up
```

To add a workspace package or service with the standard layout:

```bash
pnpm new:package packages/<name>
pnpm new:package services/<name>
```

The scope is the package or service name. `commitlint` checks this on every commit.

## Tests

A change isn't done until its behaviour is tested.

- **Unit tests** live next to the code as `*.test.ts`.
- **Integration tests** live in `packages/integration-tests` and run against a real Postgres.
- A test is written to fail first. A test that can't fail isn't testing anything.

## Before you push

```bash
pnpm gate       # everything CI checks, run directly
pnpm ci:local   # secrets and dependency advisories, then the CI and pull request workflows in containers
```

The pre-push hook runs the quick checks on its own.

CI only checks the packages a change affects, plus everything that depends on them. A change that
holds no code, such as docs or a release, skips the heavy jobs and passes in seconds. Branch
protection requires the single `CI passed` check.

## Releases

Releases are automatic. Nobody writes a version number or a tag.

- Every merge to `main` updates a release pull request titled `chore(release): x.y.z`. Merging it
  publishes the release, updates `CHANGELOG.md`, and ships the service images.
- Every release bumps the last number: `0.4.1`, `0.4.2`.
- Closing a roadmap milestone bumps the middle number: `0.4.7` becomes `0.5.0`.
- A milestone whose description contains a line reading `Release: major` bumps the first number instead.

`feat`, `fix`, `perf`, `refactor` and `revert` pull requests appear in the changelog. `docs`, `test`,
`build`, `ci` and `chore` don't.

Maschina has one version. Everything that ships together from one commit, the services and the web
app, shares it. A package that is published on its own, such as the SDK on npm, gets its own version
line and tags like `sdk-v0.3.1`, with its own changelog in its folder. Its commits are left out of the
main changelog.
