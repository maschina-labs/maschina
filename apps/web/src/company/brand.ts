/**
 * The brand assets page: the logos to download, the colors the site really uses, how much room a logo needs, and what
 * not to do with it. Every file named here is in apps/web/public/brand, and a test checks that each one exists. The
 * typeface is named, and said not to be in the kit, because its license does not allow giving it away.
 */
export type Logo = { name: string; file: string; label: string };

export type BrandDoc = {
	title: string;
	standfirst: string;
	pack: string;
	logos: { heading: string; body: string; items: Logo[] };
	colors: {
		heading: string;
		body: string;
		items: { name: string; hex: string; oklch: string; light?: boolean }[];
	};
	clearspace: { heading: string; body: string };
	typeface: { heading: string; body: string };
	rules: { heading: string; body: string; dont: string[] };
};

export const BRAND: BrandDoc = {
	title: "Brand assets",
	standfirst:
		"The Maschina logos, colors and rules for using them, for press, partners and anyone writing about us.",
	pack: "/brand/maschina-brand-kit.zip",
	logos: {
		heading: "Logos",
		body: "The primary logo is the wordmark with the mark beside it. Use the mark alone where space is tight, such as an app icon or a profile picture. White on dark backgrounds, black on light ones.",
		items: [
			{ name: "wordmark", file: "wordmark", label: "Wordmark with mark" },
			{ name: "mark", file: "mark", label: "Mark" },
			{ name: "word", file: "word", label: "Wordmark, letters only" },
		],
	},
	colors: {
		heading: "Colors",
		body: "Maschina is black and white, with a pearl and a silver for light and for lines. These are the colors the site uses.",
		items: [
			{ name: "Black", hex: "#000000", oklch: "oklch(0 0 0)" },
			{ name: "White", hex: "#FFFFFF", oklch: "oklch(1 0 0)", light: true },
			{ name: "Pearl", hex: "#EAE5F4", oklch: "oklch(0.93 0.02 300)", light: true },
			{ name: "Silver", hex: "#ADB1B9", oklch: "oklch(0.76 0.012 260)", light: true },
		],
	},
	clearspace: {
		heading: "Clearspace",
		body: "Leave a generous margin around a logo so nothing crowds it: other artwork, text, or the edge of a page. The margin is x, as shown.",
	},
	typeface: {
		heading: "Typeface",
		body: "Maschina is set in Söhne. It is a licensed typeface and is not included in the kit, so use it only if you hold a license. Where you do not, use a plain sans serif.",
	},
	rules: {
		heading: "Using the logo",
		body: "Keep the logo as it is drawn. Refer to the company as Maschina in running text, and to the company behind it as Maschina Labs.",
		dont: [
			"Do not stretch, squash or rotate the logo.",
			"Do not change its colors, or add outlines, shadows or effects.",
			"Do not place it on a busy image or a background that makes it hard to read.",
			"Do not redraw it, or rearrange the mark and the letters.",
			"Do not use it in a way that suggests Maschina has endorsed or partnered with you.",
		],
	},
};
