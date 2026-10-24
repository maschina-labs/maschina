export const PAGE_SHEET =
	"document-frame border-b border-[oklch(0.94_0.012_245/0.12)] pt-28 sm:pt-36";

export function PageStrip() {
	return (
		<div
			data-page-strip
			aria-hidden="true"
			className="pointer-events-none absolute inset-x-0 top-0 h-16 border-y border-[oklch(0.94_0.012_245/0.12)]"
		/>
	);
}
