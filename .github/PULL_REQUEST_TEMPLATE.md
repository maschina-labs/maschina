## What changed

<!-- One or two sentences. Assume the reader has not seen the issue. -->

## Why

<!-- The problem this solves. If it is a design change, say what it replaces. -->

## How it was verified

<!-- How to check this by hand. A change is done when its proof runs, not when
     the code looks right. -->

## Checklist

- [ ] `pnpm check` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm proof` passes
- [ ] No effect reaches the world without a recorded intent before it
- [ ] No new ambient authority: nothing gained permission from its surroundings
- [ ] Failures stop rather than falling back silently
- [ ] No em dashes, including in comments
