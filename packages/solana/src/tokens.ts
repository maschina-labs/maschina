/** Tokens every machine needs to know about, with their decimals. */

import { type BaseUnits, formatAmount, parseAmount } from "@maschina/core";

export const SOL = { symbol: "SOL", decimals: 9 } as const;

export const sol = (amount: string): BaseUnits => parseAmount(amount, SOL.decimals);
export const formatSol = (lamports: BaseUnits): string => formatAmount(lamports, SOL.decimals);
