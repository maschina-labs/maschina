import { Fragment } from "react";

/**
 * A sentence with something in it that is not text, such as a link: `rich("Use the {link} page", { link: <a/> })`.
 * The braces say where it goes, so a language can put it wherever its own word order wants, and a brace with nothing
 * to put in it stays as it was.
 */
export function rich(text: string, parts: Record<string, React.ReactNode>): React.ReactNode {
	return text.split(/(\{\w+\})/g).map((piece, index) => {
		const key = /^\{(\w+)\}$/.exec(piece)?.[1];
		// The pieces never change order, so their place is their key.
		return <Fragment key={index}>{key && key in parts ? parts[key] : piece}</Fragment>;
	});
}
