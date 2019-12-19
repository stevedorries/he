import { jsesc, uniq } from "../deps.ts";
import { EntityCollection } from "../types.ts";
import { regexAsciiWhitelist } from "./ascii-whitelist-regex.ts";
import { regexAstralSymbol } from "./astral-symbol-regex.ts";
import { regexBmpWhitelist } from "./bmp-whitelist-regex.ts";
import { regexEncodeNonAscii } from "./encode-non-ascii-regex.ts";
import { regexInvalidRawCodePoints } from "./invalid-code-points-regex.ts";
import { regexLegacyReference } from "./legacy-reference-regex.ts";
import { regexNamedReference  } from "./named-reference-regex.ts";
import { invalidCodePointsString } from "./invalid-code-points-string.ts";

import data from '../data/entities.json';

// https://html.spec.whatwg.org/entities.json

const encodeMap = {};
let encodeMultipleSymbols: string[] = [];
let encodeSingleCodePoints: number[] = [];
const decodeMap = {};
const decodeMapLegacy = {};

Object.entries(data as EntityCollection).forEach(([key, value]) => {
	const referenceWithLeadingAmpersand = key;
	const referenceWithoutLeadingAmpersand = referenceWithLeadingAmpersand.replace(/^&/, '');
	const referenceOnly = referenceWithoutLeadingAmpersand.replace(/;$/, '');
	const string = value.characters;
	const codePoints = value.codepoints;
	if (/;$/.test(referenceWithoutLeadingAmpersand)) {
		// Only enter this branch if the entity has a trailing semicolon.
		const tmp = encodeMap[string];
		// Prefer short named character references with as few uppercase letters as
		// possible.
		if ( // Only add an entry if…
			!tmp || ( // …there is no entry for this string yet, or…
				tmp.length > referenceOnly.length || // …this reference is shorter, or…
				(
					// …this reference contains fewer uppercase letters.
					tmp.length == referenceOnly.length &&
					(referenceOnly.match(/[A-Z]/g) || []).length <
					(tmp.match(/[A-Z]/g) || []).length
				)
			)
		) {
			encodeMap[string] = referenceOnly;
		} else {
			// Do nothing.
		}
		if (codePoints.length == 1) {
			encodeSingleCodePoints.push(codePoints[0]);
		} else {
			encodeMultipleSymbols.push(string);
		}
	}
	if (/;$/.test(referenceWithoutLeadingAmpersand)) {
		decodeMap[referenceWithoutLeadingAmpersand.replace(/;$/, '')] = string;
	} else {
		decodeMapLegacy[referenceWithoutLeadingAmpersand] = string;
	}
});

encodeMultipleSymbols = uniq(
	encodeMultipleSymbols.sort() // Sort strings by code point value.
	);

encodeSingleCodePoints = uniq(
	encodeSingleCodePoints.sort() // Sort numerically.
);

const legacyReferences = Object.keys(decodeMapLegacy).sort(function (a, b) {
	// Optimize the regular expression that will be generated based on this data
	// by sorting the references by length in descending order.
	if (a.length > b.length) {
		return -1;
	}
	if (a.length < b.length) {
		return 1;
	}
	// If the length of both strings is equal, sort alphabetically.
	if (a < b) {
		return -1;
	}
	if (a > b) {
		return 1;
	}
	return 0;
});

const writeJSON = function (fileName, object) {
	const json = jsesc(object, {
		'compact': false,
		'json': true
	});
	const encoder = new TextEncoder();
 const data = encoder.encode(`${json}\n`);
	new Deno.writeFileSync(fileName, data, { create: true});
};

/**
 * Returns a copy of an object with keys sorted
 * @param {?} object The object to be sorted
 * @returns {?} Sorted copy of the supplied object
 */
function sortObj(object) {
	const keys = Object.keys(object).sort( (a, b) => a.toLowerCase().localeCompare(b.toLowerCase()) );
	let ret = {};
	keys.forEach((key) => {
		ret[key] = object[key];
	})
	return ret;
}

writeJSON('./src/data/decode-map.json', sortObj(decodeMap));
writeJSON('./src/data/decode-map-legacy.json', sortObj(decodeMapLegacy));
writeJSON('./src/data/decode-legacy-named-references.json', legacyReferences);
writeJSON('./src/data/encode-map.json', sortObj(encodeMap));
writeJSON('./src/data/encode-paired-symbols.json', encodeMultipleSymbols);
writeJSON('./src/data/encode-lone-code-points.json', encodeSingleCodePoints);
writeJSON('./src/data/regex-ascii-whitelist.json', regexAsciiWhitelist);
writeJSON('./src/data/regex-astral-symbol.json', regexAstralSymbol);
writeJSON('./src/data/regex-bmp-whitelist.json', regexBmpWhitelist);
writeJSON('./src/data/regex-encode-non-ascii.json', regexEncodeNonAscii);
writeJSON('./src/data/regex-invalid-raw-code-points.json', regexInvalidRawCodePoints);
writeJSON('./src/data/regex-legacy-reference.json', regexLegacyReference);
writeJSON('./src/data/regex-named-reference.json', regexNamedReference);
writeJSON('./src/data/invalid-code-points-string.json', invalidCodePointsString);