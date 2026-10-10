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
	return (
		<PlainSection
			name="How it works"
			title="Give a machine a wallet and a job."
			line="Pick a kind of machine, set its limits, and let it work. Every trade is checked before it moves."
			primary={{ label: "Make a machine", href: `${authUrl}/sign-up` }}
			secondary={{ label: "Read the docs", href: DOCS }}
		/>
	);
}

export function Features({ authUrl }: { authUrl: string }) {
	return (
		<PlainSection
			name="Inside the app"
			title="See every move it makes."
			line="Your portfolio, every decision, every trade, and a manager you can ask, all in one app."
			primary={{ label: "Try it on paper", href: `${authUrl}/sign-up` }}
		/>
	);
}

export function Safety() {
	return (
		<PlainSection
			name="Safety"
			title="It cannot take your money."
			line="A machine holds no keys, and its wallet can only pay you. Every trade is checked against its limits first."
			primary={{ label: "Read how it is built", href: DOCS }}
		/>
	);
}

export function Customize({ authUrl }: { authUrl: string }) {
	return (
		<PlainSection
			name="Customize"
			title="Make it yours."
			line="Set the range, the floor and the limits on every machine. Arranging your own screens and tiles is coming soon."
			primary={{ label: "Make a machine", href: `${authUrl}/sign-up` }}
		/>
	);
}
