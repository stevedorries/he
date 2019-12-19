import { regenerate } from "../deps.ts";

export const regexAstralSymbol: string = regenerate()
	.addRange(0x010000, 0x10FFFF)
	.toString();