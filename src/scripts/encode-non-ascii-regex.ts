import  overrides  from "../data/decode-code-points-overrides.json";
import loneCodePoints from "../data/encode-lone-code-points.json";
import arrayEncodeMultipleSymbols from "../data/encode-paired-symbols.json";

import { regenerate, jsesc, difference } from "../deps.ts";

function joinStrings(a: string, b: string) {
	if (a && b) {
		return a + '|' + b;
	}
	return a + b;
};


const arrayEncodeMultipleSymbolsAscii = arrayEncodeMultipleSymbols
	.filter(function(string) {
		return /^[\0-\x7F]+$/.test(string);
	});

const encodeSingleSymbolsAscii = regenerate(loneCodePoints)
	.removeRange(0x7F + 1, 0x10FFFF).toString();
const encodeSingleSymbolsNonAscii = regenerate(loneCodePoints)
	.removeRange(0x00, 0x7F).toString();
const encodeMultipleSymbolsAscii = jsesc(
	arrayEncodeMultipleSymbolsAscii.join('|')
);
const encodeMultipleSymbolsNonAscii = jsesc(
	difference(
		arrayEncodeMultipleSymbols,
		arrayEncodeMultipleSymbolsAscii
	).join('|')
);

export const regexEncodeAscii = joinStrings(
	encodeMultipleSymbolsAscii,
	encodeSingleSymbolsAscii
);

export const regexEncodeNonAscii = joinStrings(
	encodeMultipleSymbolsNonAscii,
	encodeSingleSymbolsNonAscii
);


