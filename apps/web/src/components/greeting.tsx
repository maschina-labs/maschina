import { useEffect, useState } from "react";

/**
 * The greeting at the top of every page: short, plain, chosen fresh each time the app opens and suited
 * to the hour where the person is. The largest and quietest thing on the screen.
 */

type Part = "morning" | "afternoon" | "evening";

/** Which part of the day it is. Late at night still reads as evening: nobody wants to be told it is late. */
export function partOfDay(hour: number): Part {
	if (hour >= 5 && hour < 12) return "morning";
	if (hour >= 12 && hour < 17) return "afternoon";
	return "evening";
}

/** Greetings for each part of the day, and a few for any time. Short and plain; never a joke. */
const BY_PART: Record<Part, string[]> = {
	morning: ["Morning", "Good morning"],
	afternoon: ["Afternoon", "Good afternoon"],
	evening: ["Evening", "Good evening"],
};
const ANY_TIME = ["Hello", "Welcome back", "Back again"];

/** The greetings that suit this hour. */
export function greetingsFor(hour: number): string[] {
	return [...BY_PART[partOfDay(hour)], ...ANY_TIME];
}

/** One greeting, chosen by `pick` (a number from 0 up to 1), with the name after it when there is one. */
export function greetingFor(hour: number, name: string, pick: number): string {
	const options = greetingsFor(hour);
	const said = options[Math.min(Math.floor(pick * options.length), options.length - 1)] ?? "Hello";
	return name ? `${said}, ${name}` : said;
}

/** A name for each wallet, and which wallet was here last. Without a wallet yet, the plain key. */
const NAME = "maschina.name";
const LAST = "maschina.wallet";
const keyFor = (wallet: string | undefined) => (wallet ? `${NAME}:${wallet}` : NAME);

/** Chosen once, when the app opens, so it stays the same on every page until the next visit. */
const ON_OPEN = Math.random();

/**
 * The name to greet, remembered in this browser only, for each wallet. Signed out, it is the last wallet's
 * name, so the greeting still knows you. Missing or blocked storage just means no name.
 */
function rememberedName(wallet: string | undefined): string {
	try {
		const who = wallet ?? localStorage.getItem(LAST) ?? undefined;
		return localStorage.getItem(keyFor(who)) ?? "";
	} catch {
		return "";
	}
}

export function Greeting({
	now = () => new Date(),
	pick = ON_OPEN,
	wallet,
}: {
	now?: () => Date;
	/** Which greeting, chosen once each time the app opens. */
	pick?: number;
	/** The signed in wallet, whose name this is. */
	wallet?: string | undefined;
}) {
	const [hour, setHour] = useState(() => now().getHours());
	const [chosen] = useState(pick);
	const [name, setName] = useState(() => rememberedName(wallet));
	// A wallet signing in or out changes whose name it is.
	useEffect(() => {
		setName(rememberedName(wallet));
		if (!wallet) return;
		try {
			localStorage.setItem(LAST, wallet);
		} catch {}
	}, [wallet]);
	const [editing, setEditing] = useState(false);

	// The hour moves on while the page is left open on a nightstand.
	useEffect(() => {
		const timer = setInterval(() => setHour(now().getHours()), 60_000);
		return () => clearInterval(timer);
	}, [now]);

	const save = (value: string) => {
		const trimmed = value.trim().slice(0, 40);
		setName(trimmed);
		setEditing(false);
		try {
			const key = keyFor(wallet ?? localStorage.getItem(LAST) ?? undefined);
			if (trimmed) localStorage.setItem(key, trimmed);
			else localStorage.removeItem(key);
		} catch {}
	};

	const words = greetingFor(hour, name, chosen);
	// A name belongs to a wallet, so it can only be given once one is connected.
	if (!wallet) {
		return (
			<span className="block h-[1em] p-0 text-left font-display font-normal text-[22px] text-neutral-100 leading-none tracking-[-0.01em] md:text-[clamp(26px,2.9vw,42px)]">
				{words}
			</span>
		);
	}
	if (editing) {
		return (
			<input
				aria-label="Your name"
				defaultValue={name}
				placeholder="Your name"
				ref={(input) => input?.focus()}
				onBlur={(event) => save(event.currentTarget.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") save(event.currentTarget.value);
					if (event.key === "Escape") setEditing(false);
				}}
				className="block h-[1em] w-full max-w-[16ch] bg-transparent p-0 font-display font-normal text-[22px] md:text-[clamp(26px,2.9vw,42px)] text-neutral-100 leading-none tracking-[-0.01em] outline-none placeholder:text-neutral-600"
			/>
		);
	}
	return (
		<button
			type="button"
			title="Change the name it greets you by"
			onClick={() => setEditing(true)}
			className="block h-[1em] p-0 text-left font-display font-normal text-[22px] md:text-[clamp(26px,2.9vw,42px)] text-neutral-100 leading-none tracking-[-0.01em]"
		>
			{words}
		</button>
	);
}
