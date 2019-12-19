import { regenerate } from 'https://denopkg.com/stevedorries/regenerate/regenerate.ts';



export const regexAstralSymbol = regenerate()
	.addRange(0x010000, 0x10FFFF)
	.toString();