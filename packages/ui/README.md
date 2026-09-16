# @maschina/ui

The shared interface: design tokens, Tailwind setup and components, used by every app.

- Components are copied in from [shadcn/ui](https://ui.shadcn.com) and owned here, so an upstream
  release never restyles the product without anyone deciding to.
- Components use tokens (`bg-primary`, `text-muted-foreground`), never raw colours.
- Light and dark are both first class. `.dark` on the root switches everything.

```ts
import "@maschina/ui/styles.css";
import { Button } from "@maschina/ui";
```

**Owns:** how Maschina looks.

**Never:** fetches data or knows about machines. Components take props and render.
