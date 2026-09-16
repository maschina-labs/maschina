/**
 * Chat platforms Maschina can talk through. Each one is an adapter over the gateway: it can alert an
 * owner, relay a conversation, and pause every machine. It never holds more authority than the owner
 * signed for, and changes that touch money send the owner to the web app to sign.
 */

const PLATFORMS = ["telegram"] as const;
export type Platform = (typeof PLATFORMS)[number];

export type PlatformConfig = {
	TELEGRAM_BOT_TOKEN?: string | undefined;
};

const CONFIGURED: Record<Platform, (config: PlatformConfig) => boolean> = {
	telegram: (config) => Boolean(config.TELEGRAM_BOT_TOKEN),
};

/** The platforms with credentials configured. A platform with none is simply off. */
export function enabledPlatforms(config: PlatformConfig): Platform[] {
	return PLATFORMS.filter((platform) => CONFIGURED[platform](config));
}
