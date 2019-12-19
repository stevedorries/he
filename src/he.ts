import { default as data } from "./scripts/export-data.ts";
import {
  EncodeOptions,
  DecodeOptions,
  ForbiddenCharacterError,
  OutOfRangeError,
  MalformedDataError,
  ParseError
} from "./types.ts";

const {
  decodeMap,
  decodeMapLegacy,
  decodeMapOverrides,
  encodeMap,
  invalidReferenceCodePoints,
  regexAsciiWhitelist,
  regexAstralSymbols,
  regexBmpWhitelist,
  regexEncodeNonAscii,
  regexInvalidRawCodePoints,
  regexDecode
} = data;

const regexEscape = /["&'<>`]/g;
const escapeMap = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#x27;",
  "<": "&lt;",
  // See https://mathiasbynens.be/notes/ambiguous-ampersands: in HTML, the
  // following is not strictly necessary unless it’s part of a tag or an
  // unquoted attribute value. We’re only escaping it to support those
  // situations, and for XML support.
  ">": "&gt;",
  // In Internet Explorer ≤ 8, the backtick character can be used
  // to break out of (un)quoted attribute values or HTML comments.
  // See http://html5sec.org/#102, http://html5sec.org/#108, and
  // http://html5sec.org/#133.
  "`": "&#x60;"
};

const regexInvalidEntity = /&#(?:[xX][^a-fA-F0-9]|[^0-9xX])/;
const regexInvalidRawCodePoint = regexInvalidRawCodePoints;

/*--------------------------------------------------------------------------*/

const stringFromCharCode = String.fromCharCode;

function contains(array: any[], value: any) {
  return array.includes(value, 0);
}

// Modified version of `ucs2encode`; see https://mths.be/punycode.
function codePointToSymbol(codePoint: number, strict: boolean) {
  var output = "";
  if ((codePoint >= 0xd800 && codePoint <= 0xdfff) || codePoint > 0x10ffff) {
    // See issue #4:
    // “Otherwise, if the number is in the range 0xD800 to 0xDFFF or is
    // greater than 0x10FFFF, then this is a parse error. Return a U+FFFD
    // REPLACEMENT CHARACTER.”
    if (strict) {
      // This is the old version of the error message
      // character reference outside the permissible Unicode range
      throw parseError<OutOfRangeError>(
        "special numerical escapes (see issue #4) in strict mode"
      );
    }
    return "\uFFFD";
  }
  if (decodeMapOverrides.hasOwnProperty(codePoint)) {
    if (strict) {
      throw parseError<ForbiddenCharacterError>(
        "disallowed character reference"
      );
    }
    return decodeMapOverrides[codePoint];
  }
  if (strict && contains(invalidReferenceCodePoints, codePoint)) {
    throw parseError<ForbiddenCharacterError>("disallowed character reference");
  }
  if (codePoint > 0xffff) {
    codePoint -= 0x10000;
    output += stringFromCharCode(((codePoint >>> 10) & 0x3ff) | 0xd800);
    codePoint = 0xdc00 | (codePoint & 0x3ff);
  }
  output += stringFromCharCode(codePoint);
  return output;
}

function hexEscape(codePoint: number) {
  return "&#x" + codePoint.toString(16).toUpperCase() + ";";
}

function decEscape(codePoint: string | number) {
  return "&#" + codePoint + ";";
}
/** @throws {Error} */
function parseError<T = Error>(message: string): T {
  const err: unknown = Error("Parse error: " + message);
  return err as T;
}

/*--------------------------------------------------------------------------*/

const defaultEncodeOptions: EncodeOptions = {
  allowUnsafeSymbols: undefined,
  encodeEverything: undefined,
  strict: undefined,
  decimal: undefined
};
/**
 * Takes a string of text and encodes (by default) any symbols that aren’t printable
 * ASCII symbols( as well as `&`, `<`, `>`, `"`, `'`, and ``` ` ```), replacing them with character references.
 * @throws {Error} In strict mode invalid codepoints will cause an error to be thrown
 */
export function encode(
  string: string,
  options: EncodeOptions = defaultEncodeOptions
) {
  options = { ...defaultEncodeOptions, ...options };
  const escapeCodePoint = options.decimal ? decEscape : hexEscape;
  const {
    encodeEverything,
    strict,
    useNamedReferences,
    allowUnsafeSymbols
  } = options;
  if (strict && regexInvalidRawCodePoint.test(string)) {
    throw parseError<ForbiddenCharacterError>("forbidden code point");
  }

  function escapeBmpSymbol(symbol: string) {
    return escapeCodePoint(symbol.charCodeAt(0));
  }

  function escapeUnsafeSymbols(string: string) {
    return "&" + encodeMap[string] + ";"; // no need to check `has()` here
  }

  if (encodeEverything === true) {
    // Encode ASCII symbols.
    string = string.replace(regexAsciiWhitelist, function encodeEverything(
      symbol
    ) {
      // Use named references if requested & possible.
      if (useNamedReferences === true && encodeMap.hasOwnProperty(symbol)) {
        return "&" + encodeMap[symbol] + ";";
      }
      return escapeBmpSymbol(symbol);
    });
    // Shorten a few escapes that represent two symbols, of which at least one
    // is within the ASCII range.
    if (useNamedReferences === true) {
      string = string
        .replace(/&gt;\u20D2/g, "&nvgt;")
        .replace(/&lt;\u20D2/g, "&nvlt;")
        .replace(/&#x66;&#x6A;/g, "&fjlig;");
      // Encode non-ASCII symbols that can be replaced with a named reference.
      string = string.replace(regexEncodeNonAscii, escapeUnsafeSymbols);
    }
    // Note: any remaining non-ASCII symbols are handled outside of the `if`.
  } else if (useNamedReferences === true) {
    // Apply named character references.
    // Encode `<>"'&` using named character references.
    if (allowUnsafeSymbols !== true) {
      string = string.replace(regexEscape, escapeUnsafeSymbols);
    }
    // Shorten escapes that represent two symbols, of which at least one is
    // `<>"'&`.
    string = string
      .replace(/&gt;\u20D2/g, "&nvgt;")
      .replace(/&lt;\u20D2/g, "&nvlt;")
      .replace(regexEncodeNonAscii, escapeUnsafeSymbols);
  } else if (allowUnsafeSymbols !== true) {
    // Encode `<>"'&` using hexadecimal escapes, now that they’re not handled
    // using named character references.
    string = string.replace(regexEscape, escapeBmpSymbol);
  }
  return (
    string
      // Encode astral symbols.
      .replace(regexAstralSymbols, function encodeAstralSymbols($0) {
        // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
        var high = $0.charCodeAt(0);
        var low = $0.charCodeAt(1);
        var codePoint = (high - 0xd800) * 0x400 + low - 0xdc00 + 0x10000;
        return escapeCodePoint(codePoint);
      })
      // Encode any remaining BMP symbols that are not printable ASCII symbols
      // using a hexadecimal escape.
      .replace(regexBmpWhitelist, escapeBmpSymbol)
  );
}

const defaultDecodeOptions: DecodeOptions = {
  isAttributeValue: false,
  strict: false
};
export function decode(html: string, options = defaultDecodeOptions) {
  options = { ...defaultDecodeOptions, ...options };
  var strict = options.strict;
  if (strict && regexInvalidEntity.test(html)) {
    throw parseError<MalformedDataError>("malformed character reference");
  }
  return html.replace(regexDecode, function(
    $0,
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8
  ) {
    var codePoint;
    var semicolon;
    var decDigits;
    var hexDigits;
    var reference;
    var next;

    if ($1) {
      reference = $1;
      // Note: there is no need to check `has(decodeMap, reference)`.
      return decodeMap[reference];
    }

    if ($2) {
      // Decode named character references without trailing `;`, e.g. `&amp`.
      // This is only a parse error if it gets converted to `&`, or if it is
      // followed by `=` in an attribute context.
      reference = $2;
      next = $3;
      if (next && options.isAttributeValue) {
        if (strict && next == "=") {
          throw parseError<ParseError>(
            "`&` did not start a character reference"
          );
        }
        return $0;
      } else {
        if (strict) {
          throw parseError<ParseError>(
            "named character reference was not terminated by a semicolon"
          );
        }
        // Note: there is no need to check `has(decodeMapLegacy, reference)`.
        return decodeMapLegacy[reference] + (next || "");
      }
    }

    if ($4) {
      // Decode decimal escapes, e.g. `&#119558;`.
      decDigits = $4;
      semicolon = $5;
      if (strict && !semicolon) {
        throw parseError<ParseError>(
          "character reference was not terminated by a semicolon"
        );
      }
      codePoint = parseInt(decDigits, 10);
      return codePointToSymbol(codePoint, strict);
    }

    if ($6) {
      // Decode hexadecimal escapes, e.g. `&#x1D306;`.
      hexDigits = $6;
      semicolon = $7;
      if (strict && !semicolon) {
        throw parseError<ParseError>(
          "character reference was not terminated by a semicolon"
        );
      }
      codePoint = parseInt(hexDigits, 16);
      return codePointToSymbol(codePoint, strict);
    }

    // If we’re still here, `if ($7)` is implied; it’s an ambiguous
    // ampersand for sure. https://mths.be/notes/ambiguous-ampersands
    if (strict) {
      throw parseError<ParseError>("ambiguous ampersand in strict mode");
    }
    return $0;
  });
}

export function escape(string: string) {
  return string.replace(regexEscape, function($0) {
    // Note: there is no need to check `has(escapeMap, $0)` here.
    return escapeMap[$0];
  });
}

/*--------------------------------------------------------------------------*/

const he = {
  encode,
  decode,
  escape,
  unescape: decode
};

export default he;;