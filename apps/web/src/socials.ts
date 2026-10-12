import { GithubLogo, type Icon, XLogo, YoutubeLogo } from "@phosphor-icons/react";

/** Where Maschina is, with each one's Phosphor logo. */
export const SOCIALS: { label: string; href: string; Icon: Icon }[] = [
	{ label: "Maschina on X", href: "https://x.com/maschinalabs", Icon: XLogo },
	{
		label: "Maschina on GitHub",
		href: "https://github.com/maschina-labs/maschina",
		Icon: GithubLogo,
	},
	{
		label: "Maschina on YouTube",
		href: "https://www.youtube.com/@MaschinaLabs",
		Icon: YoutubeLogo,
	},
];
