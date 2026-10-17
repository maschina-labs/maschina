import { Builders } from "./builders.tsx";
import { Closing } from "./closing.tsx";
import { Faq } from "./faq.tsx";
import { Frame } from "./frame.tsx";
import { Hero } from "./hero.tsx";
import {
	Customize,
	Features,
	HowItWorks,
	LiveRecord,
	Marketplace,
	Network,
	Safety,
} from "./sections.tsx";
import { Showcase } from "./showcase.tsx";

/**
 * The front page, built one piece at a time: the hero, the app showcase, the explaining sections, the live record, the network and the marketplace (the last three not built yet and
 * saying so), for builders, the
 * questions and the closing section, as plain sections one after the other, inside the frame every page shares.
 */
export function Site({ authUrl }: { authUrl: string }) {
	return (
		<Frame authUrl={authUrl}>
			<Hero authUrl={authUrl} />
			<Showcase />
			<HowItWorks authUrl={authUrl} />
			<Features authUrl={authUrl} />
			<Safety />
			<Customize authUrl={authUrl} />
			<LiveRecord />
			<Network />
			<Marketplace />
			<Builders />
			<Faq />
			<Closing authUrl={authUrl} />
		</Frame>
	);
}
