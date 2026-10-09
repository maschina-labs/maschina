/**
 * The pieces of the operating system, floated around the headline. Each is a true line from the pitch, so
 * the page explains the idea without claiming more than the code does. The depth is how far each moves as
 * the cursor or the page does (near ones move more); place is where it sits.
 *
 * Swap these for real entries from the machine's public record (a trade with its reason, a refusal) once
 * the record's address is known.
 */
export type Tile = {
	name: string;
	title: string;
	body: string;
	depth: number;
	tilt: string;
	place: string;
};

export const TILES: Tile[] = [
	{
		name: "Wallet",
		title: "Its own wallet",
		body: "Keys stay with the wallet provider, whose policy only ever pays the owner.",
		depth: 0.55,
		tilt: "-3deg",
		place: "left-[6%] top-[13%] md:top-[24%]",
	},
	{
		name: "Budget",
		title: "A budget it can't edit",
		body: "Held in a ledger the machine has no way to change.",
		depth: 1,
		tilt: "2deg",
		place: "right-[6%] bottom-[7%] md:top-[20%] md:bottom-auto",
	},
	{
		name: "Rules",
		title: "Rules before every trade",
		body: "Checked before anything is signed, outside the AI.",
		depth: 0.8,
		tilt: "2deg",
		place: "hidden md:block left-[9%] bottom-[16%]",
	},
	{
		name: "Signer",
		title: "One way to sign",
		body: "The only thing allowed to ask for a signature.",
		depth: 0.45,
		tilt: "-2deg",
		place: "hidden md:block right-[9%] bottom-[20%]",
	},
	{
		name: "Record",
		title: "Every trade and every refusal",
		body: "Append only, and public to check.",
		depth: 1.2,
		tilt: "-1.5deg",
		place: "hidden lg:block right-[28%] top-[9%]",
	},
];
