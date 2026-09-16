# @maschina/config

Shared configuration that every workspace extends.

| File | Use it for |
| --- | --- |
| `tsconfig/base.json` | The strict compiler settings everything shares |
| `tsconfig/library.json` | Pure packages with no runtime types |
| `tsconfig/node.json` | Services and packages that run on Node |
| `tsconfig/react.json` | The web app and UI package |
| `vitest.ts` | `vitestConfig()`, the test setup every workspace uses |

**Owns:** compiler and test settings.
**Never:** runtime code. Nothing here ships.
