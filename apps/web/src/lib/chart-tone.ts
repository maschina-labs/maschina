/**
 * A theme color for TradingView's charting library, which mixes colors itself on its canvas and only
 * reads rgb and hex. OKLCH to sRGB by Björn Ottosson's matrices, the same ones the background shader uses.
 */

export function rgbaOf(color: string, alpha = 1): string | undefined {
	const found = /^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/.exec(color.trim());
	if (!found) return undefined;
	const l = Number(found[1]) / 100;
	const c = Number(found[2]);
	const h = (Number(found[3]) * Math.PI) / 180;
	const a = c * Math.cos(h);
	const b = c * Math.sin(h);
	const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const linear = [
		4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
		-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
		-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
	];
	const [r, g, bl] = linear.map((value) => {
		const clamped = Math.min(1, Math.max(0, value));
		const srgb = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
		return Math.round(srgb * 255);
	});
	return `rgba(${r}, ${g}, ${bl}, ${alpha})`;
}
