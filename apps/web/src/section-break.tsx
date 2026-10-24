export function SectionBreak() {
	return (
		<div
			aria-hidden="true"
			className="min-h-20 w-full border-y border-[oklch(0.94_0.012_245/0.12)] bg-black px-4 md:px-(--gutter) sm:min-h-24"
		>
			<div className="section-strip-frame flex min-h-20 items-center gap-6 border-x border-[oklch(0.94_0.012_245/0.12)] md:px-6 sm:min-h-24"></div>
		</div>
	);
}
