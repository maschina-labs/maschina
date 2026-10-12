import { CaretRight } from "@phosphor-icons/react";
import { Link } from "./i18n/link.tsx";
import { useMessages } from "./i18n/use-messages.ts";

/**
 * The main call to action: the pearl button with a small square black chip inset beside the words, a chevron
 * pointing right in white. The chip is smaller than the button, so pearl shows all around it.
 * It is part of the link, so the whole thing is one click, and the chevron is decoration (the name is just the
 * words, "Try Maschina" unless another label is given).
 */
export function TryButton({
	href,
	className,
	labelClassName,
	chipClassName,
	label,
}: {
	href: string;
	className: string;
	labelClassName: string;
	chipClassName: string;
	label?: string;
}) {
	const m = useMessages();
	return (
		<Link
			href={href}
			className={`items-center gap-3 silver-button text-black max-sm:font-medium ${className}`}
		>
			<span className={labelClassName}>{label ?? m.header.tryMaschina}</span>
			<span
				data-chip
				className={`relative z-10 grid place-items-center bg-black text-white max-sm:hidden ${chipClassName}`}
			>
				<CaretRight weight="regular" className="size-3.5" data-arrow="chevron" aria-hidden="true" />
			</span>
		</Link>
	);
}
