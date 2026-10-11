import { Footer } from "./footer.tsx";
import { Header } from "./header.tsx";
import { PreferencesToast } from "./preferences-toast.tsx";
import { PullToRefresh } from "./pull-refresh.tsx";

/**
 * The frame every page has: the header on top, the page's own content as the main part, and the footer. The front
 * page and each other page are laid out inside it, so the header and the footer are the same everywhere.
 */
export function Frame({
	authUrl,
	children,
	className = "",
}: {
	authUrl: string;
	children: React.ReactNode;
	/** Added to the main part: a blank page gives it a full screen of height. */
	className?: string;
}) {
	return (
		<PullToRefresh className="relative flex min-h-lvh flex-col bg-black">
			<Header authUrl={authUrl} />
			<main className={className}>{children}</main>
			<Footer />
			<PreferencesToast />
		</PullToRefresh>
	);
}
