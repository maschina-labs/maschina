/**
 * The shared surface.
 *
 * Everything a window is built from. Exported by name rather than as a namespace
 * so an unused primitive is shaken out of the bundle rather than shipped.
 *
 * Copied components from shadcn and beautifui.dev land in `primitives/` as source
 * and are edited in place. Both are MIT and both are copy-paste by design, so
 * there is no component dependency here and no upgrade that can restyle the
 * application without somebody asking for it.
 */

export { cn } from "./lib/cn.ts";
export { Badge, type BadgeProps } from "./primitives/badge.tsx";
export { Button, type ButtonProps, buttonVariants } from "./primitives/button.tsx";
export { Empty } from "./primitives/empty.tsx";
export { Input, Textarea } from "./primitives/input.tsx";
export { Notice } from "./primitives/notice.tsx";
export { Panel, PanelBody, PanelHead } from "./primitives/panel.tsx";
