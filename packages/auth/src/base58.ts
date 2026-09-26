/**
 * Base58, the encoding Solana writes addresses and signatures in.
 *
 * Twenty lines, so that proving who is asking does not drag a chain library into a service that never
 * touches a chain. Decoding only: nothing here needs to encode.
 */

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const VALUES = new Map([...ALPHABET].map((character, index) => [character, index]));

/** The base58 an API expects, for bytes a wallet just handed back. */
export function encodeBase58(bytes: Uint8Array): string {
	if (bytes.length === 0) return "";

	let number = 0n;
	for (const byte of bytes) number = number * 256n + BigInt(byte);

	let text = "";
	while (number > 0n) {
		text = ALPHABET[Number(number % 58n)] + text;
		number /= 58n;
	}

	// A leading zero byte carries no value, so it has to be written back as a leading '1'.
	for (const byte of bytes) {
		if (byte !== 0) break;
		text = `1${text}`;
	}
	return text;
}

/** The bytes a base58 string stands for. Throws on anything that is not base58. */
export function decodeBase58(text: string): Uint8Array<ArrayBuffer> {
	if (text.length === 0) return new Uint8Array(new ArrayBuffer(0));

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
