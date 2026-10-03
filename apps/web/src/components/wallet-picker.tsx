import { Star, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { preview } from "../lib/preview.ts";
import {
	choose,
	defaultWallet,
	dismissPicker,
	pickWallet,
	setDefaultWallet,
	usePickerOpen,
	useWallets,
} from "../lib/wallet.ts";

/**
 * Choosing a wallet: every Solana wallet installed in this browser, each with its own icon, in the app's
 * own colors so it reads as part of Maschina rather than a stranger's dialog laid on top. Nothing is
 * preselected unless the owner has made one their default, which then sits first. Mounted once; any
 * sign in asks it.
 */

const GET = [
	{ name: "Solflare", href: "https://solflare.com" },
	{ name: "Jupiter", href: "https://jup.ag/mobile" },
	{ name: "Backpack", href: "https://backpack.app" },
	{ name: "Phantom", href: "https://phantom.com" },
];

export function WalletPicker() {
	const open = usePickerOpen();
	const wallets = useWallets();
	const [chosenDefault, setChosenDefault] = useState(defaultWallet);
	// ?wallets opens it on arrival while developing, to look at it.
	useEffect(() => {
		if (preview("wallets") !== undefined) pickWallet().catch(() => undefined);
	}, []);
	useEffect(() => {
		if (!open) return;
		setChosenDefault(defaultWallet());
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") dismissPicker();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);
	if (!open) return null;

	const toggleDefault = (name: string) => {
		const next = chosenDefault === name ? undefined : name;
		setDefaultWallet(next);
		setChosenDefault(next);
	};

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Choose a wallet"
			className="fixed inset-0 z-[70] grid place-items-center px-4"
		>
			<button
				type="button"
				aria-label="Close"
				tabIndex={-1}
				onClick={dismissPicker}
				className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[2px]"
			/>
			<div className="relative flex w-full max-w-[400px] flex-col gap-4 bg-(--surface-sheet) p-6 shadow-[0_32px_64px_-16px_oklch(0_0_0/0.5)]">
				<div className="flex items-start justify-between gap-4">
					<div className="flex flex-col gap-1">
						<h2 className="font-display text-[22px] text-neutral-100 leading-none">
							Choose a wallet
						</h2>
						<p className="text-[13px] text-neutral-500">It signs you in. Nothing is spent.</p>
					</div>
					<button
						type="button"
						aria-label="Close wallets"
						onClick={dismissPicker}
						className="grid size-9 place-items-center bg-white/[0.08] text-neutral-300 transition-colors hover:bg-white/[0.14] hover:text-neutral-100"
					>
						<X size={16} weight="light" />
					</button>
				</div>

				{wallets.length ? (
					<ul aria-label="Installed wallets" className="flex flex-col gap-1.5">
						{wallets.map((wallet) => {
							const isDefault = chosenDefault === wallet.name;
							return (
								<li key={wallet.name} className="flex gap-1.5">
									<button
										type="button"
										onClick={() => choose(wallet.name)}
										className="flex flex-1 items-center gap-3 bg-white/[0.06] px-4 py-3 text-left transition-colors hover:bg-white/[0.12]"
									>
										<img src={wallet.icon} alt="" className="size-7 shrink-0 rounded-[6px]" />
										<span className="flex-1 font-display text-[16px] text-neutral-100">
											{wallet.name}
										</span>
										{isDefault ? (
											<span className="text-[12px] text-neutral-500">Default</span>
										) : null}
									</button>
									<button
										type="button"
										aria-label={
											isDefault
												? `Stop using ${wallet.name} by default`
												: `Use ${wallet.name} by default`
										}
										aria-pressed={isDefault}
										title={isDefault ? "Your default" : "Make this your default"}
										onClick={() => toggleDefault(wallet.name)}
										className={`grid w-12 place-items-center transition-colors ${isDefault ? "bg-white/[0.14] text-neutral-100" : "bg-white/[0.06] text-neutral-500 hover:bg-white/[0.12] hover:text-neutral-100"}`}
									>
										<Star size={16} weight={isDefault ? "fill" : "light"} />
									</button>
								</li>
							);
						})}
					</ul>
				) : (
					<div className="flex flex-col gap-3">
						<p className="text-[15px] text-neutral-300">
							No Solana wallet is installed in this browser.
						</p>
						<div className="grid grid-cols-2 gap-1.5">
							{GET.map((each) => (
								<a
									key={each.name}
									href={each.href}
									target="_blank"
									rel="noreferrer"
									className="bg-white/[0.06] px-4 py-3 text-[14px] text-neutral-100 transition-colors hover:bg-white/[0.12]"
								>
									Get {each.name}
								</a>
							))}
						</div>
					</div>
				)}
				<p className="text-[12px] text-neutral-500">
					The star makes a wallet your default: it is listed first, and nothing else is ever chosen
					for you.
				</p>
			</div>
		</div>
	);
}
