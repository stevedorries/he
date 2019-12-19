import  overrides  from "../data/decode-code-points-overrides.json";
import { regenerate } from "../deps.ts";

export const regexBmpWhitelist: string = regenerate()
	// Add all BMP symbols.
	.addRange(0x0, 0xFFFF)
	// Remove ASCII newlines.
	.remove('\r', '\n')
	// Remove printable ASCII symbols.
	.removeRange(0x20, 0x7E)
	// Remove code points listed in the first column of the overrides table.
	// https://html.spec.whatwg.org/multipage/syntax.html#table-charref-overrides
	.remove(overrides)
	.toString({ 'bmpOnly': true });

export const regexBmpWhitelistRegExp = new RegExp(regexBmpWhitelist, "g");