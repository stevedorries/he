import { jsesc } from "../deps.ts";

import regexAsciiWhitelist from "../data/regex-ascii-whitelist.json";
import regexAstralSymbol from "../data/regex-astral-symbol.json";
import regexBmpWhitelist from "../data/regex-bmp-whitelist.json";
import regexEncodeNonAscii from "../data/regex-encode-non-ascii.json";
import regexInvalidRawCodePoints from "../data/regex-invalid-raw-code-points.json";
import regexLegacyReferenceSource from "../data/regex-legacy-reference.json";
import regexNamedReferenceSource from "../data/regex-named-reference.json";
import stringInvalidCodePoint from "../data/invalid-code-points-string.json";
import decodeMap from "../data/decode-map.json";
import decodeMapLegacy from "../data/decode-map-legacy.json";
import decodeMapOverrides from "../data/decode-map-overrides.json";
import encodeMap from "../data/encode-map.json";
import invalidReferenceCodePoints from "../data/invalid-character-reference-code-points.json";
import testData from "../data/entities.json";

export const stringInvalidCodePoints = stringInvalidCodePoint;
export const testDataMap = testData;

const regexDecimalEscapeSource = "&#([0-9]+)(;?)";
const regexHexadecimalEscapeSource = "&#[xX]([a-fA-F0-9]+)(;?)";
const regexAmbiguousAmpersand = "&([0-9a-zA-Z]+)";

const formatJSON = function(object) {
  return jsesc(object, {
    compact: true,
    quotes: "single"
  });
};

export default {
  decodeMap,
  decodeMapLegacy,
  decodeMapOverrides,
  encodeMap,
  invalidReferenceCodePoints,
  testDataMap,
  regexDecimalEscapeSource,
  regexHexadecimalEscapeSource,
  regexAmbiguousAmpersand,
  /**
   * All ASCII symbols (not just printable ASCII) except those listed in the
   * first column of the overrides table.
   * https://html.spec.whatwg.org/multipage/syntax.html#table-charref-overrides
   */
  regexAsciiWhitelist: new RegExp(regexAsciiWhitelist, "g"),
  regexAstralSymbols: new RegExp(regexAstralSymbol, "g"),
  /**
   * All BMP symbols that are not ASCII newlines, printable ASCII symbols, or
   * code points listed in the first column of the overrides table on
   * https://html.spec.whatwg.org/multipage/syntax.html#table-charref-overrides.
   */

  regexBmpWhitelist: new RegExp(regexBmpWhitelist, "g"),
  regexEncodeNonAscii: new RegExp(regexEncodeNonAscii, "g"),
  regexInvalidRawCodePoints: new RegExp(regexInvalidRawCodePoints),
  regexLegacyReferenceSource: new RegExp(regexLegacyReferenceSource, "g"),
  regexNamedReferenceSource: new RegExp(regexNamedReferenceSource, "g"),
  regexInvalidCodePoints: new RegExp(stringInvalidCodePoint, "g"),
  regexDecode: new RegExp(
    `${regexNamedReferenceSource}|${regexLegacyReferenceSource}|${regexDecimalEscapeSource}|${regexHexadecimalEscapeSource}|${regexAmbiguousAmpersand}`,
    "g"
  ),
  version: "1.0.0"
};
