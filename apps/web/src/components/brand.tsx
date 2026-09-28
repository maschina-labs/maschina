/**
 * The Maschina mark, from the designer's files in `public/brand`: a disc with a hexagon cut out of it.
 * Drawn in `currentColor`, so it takes the colour of the text around it.
 */

type BrandProps = { className?: string };

/** The mark on its own: a disc with a hexagon cut out of it. */
export function LogoMark({ className }: BrandProps) {
	return (
		<svg
			viewBox="0 0 500 500"
			fill="currentColor"
			className={className}
			role="img"
			aria-label="Maschina"
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M250 0C388.071 0 500 111.929 500 250C500 388.071 388.071 500 250 500C111.929 500 0 388.071 0 250C0 111.929 111.929 0 250 0ZM260.998 61.7725C254.81 58.1998 247.186 58.1998 240.998 61.7725L92.123 147.725C85.935 151.297 82.123 157.901 82.123 165.046V336.951C82.123 344.096 85.935 350.7 92.123 354.272L240.998 440.225C247.186 443.797 254.81 443.797 260.998 440.225L409.873 354.272C416.061 350.7 419.873 344.096 419.873 336.951V165.046C419.873 157.901 416.061 151.297 409.873 147.725L260.998 61.7725Z"
			/>
		</svg>
	);
}
