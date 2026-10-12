import { Frame } from "./frame.tsx";
import { Link } from "./i18n/link.tsx";
import { useMessages } from "./i18n/use-messages.ts";
import { useTitle } from "./use-title.ts";

/**
 * The page for an address that has none: it says so plainly and leads home. It is a page of its own so nobody is sent to
 * a screen that looks like the front page but is not, and a reader who cannot see it still hears where they are.
 */
export function NotFoundPage({ authUrl }: { authUrl: string }) {
	const m = useMessages().notFound;
	useTitle(m.title);
	return (
		<Frame authUrl={authUrl} className="min-h-lvh">
			<div className="mx-auto flex min-h-[70lvh] w-full max-w-[40rem] flex-col items-center justify-center px-(--gutter) text-center">
				<p className="text-[14px] text-neutral-500">{m.code}</p>
				<h1 className="mt-5 font-display font-medium text-[clamp(2.5rem,6vw,4.5rem)] text-white leading-[0.98] tracking-[-0.04em]">
					{m.title}
				</h1>
				<p className="mt-6 text-[19px] text-neutral-400 leading-[1.6]">{m.body}</p>
				<Link
					href="/"
					className="mt-10 inline-flex h-11 items-center silver-button px-6 text-[15px] text-black"
				>
					{m.home}
				</Link>
			</div>
		</Frame>
	);
}
