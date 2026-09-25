/**
 * Base58, the encoding Solana writes addresses and signatures in.
 *
 * Twenty lines, so that proving who is asking does not drag a chain library into a service that never
 * touches a chain. Decoding only: nothing here needs to encode.
 */

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const VALUES = new Map([...ALPHABET].map((character, index) => [character, index]));

/** The bytes a base58 string stands for. Throws on anything that is not base58. */
export function decodeBase58(text: string): Uint8Array {
	if (text.length === 0) return new Uint8Array();

	let number = 0n;
	for (const character of text) {
		const value = VALUES.get(character);
		if (value === undefined) throw new Error("not base58");
		number = number * 58n + BigInt(value);
	}

	const bytes: number[] = [];
	while (number > 0n) {
		bytes.unshift(Number(number % 256n));
		number /= 256n;
	}

	// Every leading '1' is a leading zero byte, which the arithmetic above cannot carry.
	for (const character of text) {
		if (character !== "1") break;
		bytes.unshift(0);
	}
	return new Uint8Array(bytes);
}
