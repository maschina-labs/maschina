import { BuilderWorkbench } from "./builder-workbench.tsx";
import { Closing } from "./closing.tsx";
import { ControlsSection } from "./controls-section.tsx";
import { CapabilitiesSection, MarketplaceSection, NetworkSection } from "./ecosystem-sections.tsx";
import { EvidenceSection } from "./evidence-section.tsx";
import { Faq } from "./faq.tsx";
import { Frame } from "./frame.tsx";
import { Hero } from "./hero.tsx";
import { HowItWorksSection } from "./how-it-works-section.tsx";
import { useMessages } from "./i18n/use-messages.ts";
import { DOCS, LIVE, STATUS } from "./links.ts";
import { PaperMode } from "./paper-mode.tsx";
import { SectionBreak } from "./section-break.tsx";
import { SectionLinks } from "./section-links.tsx";
import { Showcase } from "./showcase.tsx";

export function Site({ authUrl }: { authUrl: string }) {
	const m = useMessages();
	const label = (key: string) => m.labels[key] ?? key;
	const destinations = [
		{ label: label("Machines"), line: m.home.destinations.machines, href: "/machines" },
		{ label: label("Network"), line: m.home.destinations.network, href: "/network" },
		{ label: label("Marketplace"), line: m.home.destinations.marketplace, href: "/marketplace" },
	];
	return (
		<Frame authUrl={authUrl} framed={false}>
			<Hero authUrl={authUrl} />
			<SectionLinks name={m.home.destinations.name} links={destinations} />
			<Showcase />
			<SectionBreak />
			<HowItWorksSection />
			<SectionBreak />
			<CapabilitiesSection />
			<SectionBreak />
			<ControlsSection />
			<SectionLinks
				name={m.home.sectionLinks.controls}
				links={[
					{
						label: label("Security"),
						line: m.home.sectionLinks.securityLine,
						href: "/security",
					},
					{
						label: label("Risk Disclosure"),
						line: m.home.sectionLinks.riskLine,
						href: "/risk",
					},
					{ label: label("Docs"), line: m.home.sectionLinks.docsLine, href: DOCS },
				]}
			/>
			<PaperMode authUrl={authUrl} />
			<SectionBreak />
			<EvidenceSection />
			<SectionLinks
				name={m.home.sectionLinks.evidence}
				links={[
					{ label: label("Live Record"), line: m.home.sectionLinks.recordLine, href: LIVE },
					{
						label: label("GitHub"),
						line: m.home.sectionLinks.codeLine,
						href: "https://github.com/maschina-labs/maschina",
					},
					{ label: label("Status"), line: m.home.sectionLinks.statusLine, href: STATUS },
				]}
			/>
			<NetworkSection />
			<SectionBreak />
			<MarketplaceSection />
			<SectionBreak />
			<BuilderWorkbench />
			<SectionBreak />
			<Faq />
			<SectionBreak />
			<Closing authUrl={authUrl} />
			<SectionBreak />
		</Frame>
	);
}
