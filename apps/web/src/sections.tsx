import { useMessages } from "./i18n/use-messages.ts";
import { DOCS } from "./links.ts";
import { PlainSection } from "./plain-section.tsx";

/**
 * The sections that explain the product, each in the plain frame until it is designed: a title, one line and a
 * button or two. Every line is true today. A machine is given a wallet and a job and works inside limits; it holds
 * no keys and its wallet can only pay its owner; every trade is checked against its limits before it is signed;
 * machines can be made on paper; the range, floor, amount and limits are set per machine. Rearranging your own
 * screens and tiles is not built, so that is said to be coming and nothing more.
 */
export function HowItWorks({ authUrl }: { authUrl: string }) {
	const m = useMessages().home.how;
	return (
		<PlainSection
			name={m.name}
			title={m.title}
			line={m.line}
			primary={{ label: m.primary, href: `${authUrl}/sign-up` }}
			secondary={{ label: m.secondary, href: DOCS }}
		/>
	);
}

export function Features({ authUrl }: { authUrl: string }) {
	const m = useMessages().home.inside;
	return (
		<PlainSection
			name={m.name}
			title={m.title}
			line={m.line}
			primary={{ label: m.primary, href: `${authUrl}/sign-up` }}
		/>
	);
}

export function Safety() {
	const m = useMessages().home.safety;
	return (
		<PlainSection
			name={m.name}
			title={m.title}
			line={m.line}
			primary={{ label: m.primary, href: DOCS }}
		/>
	);
}

export function Customize({ authUrl }: { authUrl: string }) {
	const m = useMessages().home.customize;
	return (
		<PlainSection
			name={m.name}
			title={m.title}
			line={m.line}
			primary={{ label: m.primary, href: `${authUrl}/sign-up` }}
		/>
	);
}
