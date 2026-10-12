import { CaretDown, Check, Globe } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { saveLanguage } from "./i18n/language.ts";
import { AVAILABLE } from "./i18n/languages.ts";
import { useLocale } from "./i18n/locale-context.tsx";
import { LOCALES, type LocaleCode, localizePath, parsePath } from "./i18n/locales.ts";
import { useMessages } from "./i18n/use-messages.ts";
import { usePresence } from "./presence.ts";

/** How long the popover takes to leave, so it fades away rather than blinking out. */
const POPOVER_EXIT_MS = 180;

/**
 * The language box at the foot of the page: the code of the language being read, and a popover above it listing every
 * language by its own name. A language whose pages are not all translated yet is dimmed and tagged Soon, and pressing it
 * changes nothing. Pressing one that is ready remembers the choice, in a cookie, and goes to the same page in that
 * language. Choosing English is a choice like any other and is kept the same way, so nothing the browser says can undo
 * it. Nothing here guesses a language for the visitor.
 */
export function LanguageSwitcher({
	available = AVAILABLE,
	navigate = (href: string) => window.location.assign(href),
}: {
	available?: readonly LocaleCode[];
	navigate?: (href: string) => void;
}) {
	const locale = useLocale();
	const m = useMessages();
	const [open, setOpen] = useState(false);
	const root = useRef<HTMLDivElement>(null);
	const button = useRef<HTMLButtonElement>(null);
	const popover = usePresence(
		open,
		window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : POPOVER_EXIT_MS,
	);

	// Escape and a press anywhere outside close it. Neither listens while it is shut.
	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
		const onPress = (event: PointerEvent) => {
			if (!root.current?.contains(event.target as Node)) setOpen(false);
		};
		document.addEventListener("keydown", onKey);
		document.addEventListener("pointerdown", onPress);
		return () => {
			document.removeEventListener("keydown", onKey);
			document.removeEventListener("pointerdown", onPress);
		};
	}, [open]);

	function choose(code: LocaleCode) {
		if (!available.includes(code)) return;
		saveLanguage(code);
		setOpen(false);
		button.current?.focus();
		const { pathname, search, hash } = window.location;
		navigate(localizePath(`${parsePath(pathname).path}${search}${hash}`, code));
	}

	return (
		<div ref={root} className="relative">
			<button
				ref={button}
				type="button"
				aria-label={m.language.label}
				aria-haspopup="listbox"
				aria-expanded={open}
				onClick={() => setOpen((now) => !now)}
				className="flex h-9 items-center gap-2 bg-white/[0.07] pr-3 pl-3 text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.11]"
			>
				<Globe weight="light" className="size-[16px]" aria-hidden="true" />
				<span>{locale.toUpperCase()}</span>
				<CaretDown
					weight="regular"
					className={`size-3 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
					aria-hidden="true"
				/>
			</button>
			{popover.mounted ? (
				<div
					className={`absolute right-0 bottom-full z-10 mb-2 w-56 bg-[oklch(0.2_0.008_285)] transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${popover.visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
				>
					<div
						role="listbox"
						aria-label={m.language.label}
						className="flex max-h-72 flex-col overflow-y-auto p-1"
					>
						{LOCALES.map((language) => {
							const ready = available.includes(language.code);
							const chosen = locale === language.code;
							return (
								<button
									key={language.code}
									type="button"
									role="option"
									lang={language.tag}
									aria-selected={chosen}
									aria-disabled={ready ? undefined : true}
									onClick={() => choose(language.code)}
									className={`flex items-center gap-3 px-3 py-2 text-left text-[13px] transition-colors ${ready ? "text-neutral-300 hover:bg-white/[0.08] hover:text-neutral-100" : "cursor-default text-neutral-600"}`}
								>
									<span data-name>{language.name}</span>
									{ready ? null : (
										<span className="ml-auto text-[11px] text-neutral-600">{m.language.soon}</span>
									)}
									<span
										data-box
										className={`${ready ? "ml-auto" : ""} grid size-4 shrink-0 place-items-center border ${chosen ? "border-transparent bg-[oklch(0.93_0.02_300)] text-black" : "border-white/25"}`}
									>
										{chosen ? <Check weight="bold" className="size-3" aria-hidden="true" /> : null}
									</span>
								</button>
							);
						})}
					</div>
				</div>
			) : null}
		</div>
	);
}
