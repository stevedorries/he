// Copyright 2018-2019 the Deno authors. All rights reserved. MIT license.

// A script preamble that provides the ability to load a single outfile
// TypeScript "bundle" where a main module is loaded which recursively
// instantiates all the other modules in the bundle.  This code is used to load
// bundles when creating snapshots, but is also used when emitting bundles from
// Deno cli.

/**
 * @type {(name: string, deps: ReadonlyArray<string>, factory: (...deps: any[]) => void) => void}
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let define;

/**
 * @type {(mod: string | string[]) => void}
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let instantiate;

/**
 * @callback Factory
 * @argument {...any[]} args
 * @returns {object | void}
 */

/**
 * @typedef ModuleMetaData
 * @property {ReadonlyArray<string>} dependencies
 * @property {(Factory | object)=} factory
 * @property {object} exports
 */

(function() {
  /**
   * @type {Map<string, ModuleMetaData>}
   */
  const modules = new Map();

  /**
   * Bundles in theory can support "dynamic" imports, but for internal bundles
   * we can't go outside to fetch any modules that haven't been statically
   * defined.
   * @param {string[]} deps
   * @param {(...deps: any[]) => void} resolve
   * @param {(err: any) => void} reject
   */
  const require = (deps, resolve, reject) => {
    try {
      if (deps.length !== 1) {
        throw new TypeError("Expected only a single module specifier.");
      }
      if (!modules.has(deps[0])) {
        throw new RangeError(`Module "${deps[0]}" not defined.`);
      }
      resolve(getExports(deps[0]));
    } catch (e) {
      if (reject) {
        reject(e);
      } else {
        throw e;
      }
    }
  };

  define = (id, dependencies, factory) => {
    if (modules.has(id)) {
      throw new RangeError(`Module "${id}" has already been defined.`);
    }
    modules.set(id, {
      dependencies,
      factory,
      exports: {}
    });
  };

  /**
   * @param {string} id
   * @returns {any}
   */
  function getExports(id) {
    const module = modules.get(id);
    if (!module) {
      // because `$deno$/ts_global.d.ts` looks like a real script, it doesn't
      // get erased from output as an import, but it doesn't get defined, so
      // we don't have a cache for it, so because this is an internal bundle
      // we can just safely return an empty object literal.
      return {};
    }
    if (!module.factory) {
      return module.exports;
    } else if (module.factory) {
      const { factory, exports } = module;
      delete module.factory;
      if (typeof factory === "function") {
        const dependencies = module.dependencies.map(id => {
          if (id === "require") {
            return require;
          } else if (id === "exports") {
            return exports;
          }
          return getExports(id);
        });
        factory(...dependencies);
      } else {
        Object.assign(exports, factory);
      }
      return exports;
    }
  }

  instantiate = dep => {
    define = undefined;
    if (Array.isArray(dep)) {
      for (const d of dep) {
        getExports(d);
      }
    } else {
      getExports(dep);
    }
    // clean up, or otherwise these end up in the runtime environment
    instantiate = undefined;
  };
})();

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
define("https://raw.githubusercontent.com/stevedorries/regenerate/master/regenerate", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const ERRORS = {
        rangeOrder: "A range\u2019s `stop` value must be greater than or equal " +
            "to the `start` value.",
        codePointRange: "Invalid code point value. Code points range from " +
            "U+000000 to U+10FFFF."
    };
    // https://mathiasbynens.be/notes/javascript-encoding#surrogate-pairs
    const HIGH_SURROGATE_MIN = 0xd800;
    const HIGH_SURROGATE_MAX = 0xdbff;
    const LOW_SURROGATE_MIN = 0xdc00;
    const LOW_SURROGATE_MAX = 0xdfff;
    // In Regenerate output, `\0` is never preceded by `\` because we sort by
    // code point value, so let’s keep this regular expression simple.
    const regexNull = /\\x00([^0123456789]|$)/g;
    function isNumber(x) {
        return typeof x === "number";
    }
    // This assumes that `number` is a positive integer that `toString()`s nicely
    // (which is the case for all code point values).
    const zeroes = "0000";
    function pad(number, totalCharacters) {
        let string = String(number);
        return string.length < totalCharacters
            ? (zeroes + string).slice(-totalCharacters)
            : string;
    }
    function hex(number) {
        return Number(number)
            .toString(16)
            .toUpperCase();
    }
    const slice = [].slice;
    /*--------------------------------------------------------------------------*/
    function dataFromCodePoints(codePoints) {
        let index = -1;
        let length = codePoints.length;
        let max = length - 1;
        let result = [];
        let isStart = true;
        let tmp;
        let previous = 0;
        while (++index < length) {
            tmp = codePoints[index];
            if (isStart) {
                result.push(tmp);
                previous = tmp;
                isStart = false;
            }
            else {
                if (tmp == previous + 1) {
                    if (index != max) {
                        previous = tmp;
                        continue;
                    }
                    else {
                        isStart = true;
                        result.push(tmp + 1);
                    }
                }
                else {
                    // End the previous range and start a new one.
                    result.push(previous + 1, tmp);
                    previous = tmp;
                }
            }
        }
        if (!isStart) {
            result.push(tmp + 1);
        }
        return result;
    }
    function dataRemove(data, codePoint) {
        // Iterate over the data per `(start, end)` pair.
        let index = 0;
        let start;
        let end;
        let length = data.length;
        while (index < length) {
            start = data[index];
            end = data[index + 1];
            if (codePoint >= start && codePoint < end) {
                // Modify this pair.
                if (codePoint == start) {
                    if (end == start + 1) {
                        // Just remove `start` and `end`.
                        data.splice(index, 2);
                        return data;
                    }
                    else {
                        // Just replace `start` with a new value.
                        data[index] = codePoint + 1;
                        return data;
                    }
                }
                else if (codePoint == end - 1) {
                    // Just replace `end` with a new value.
                    data[index + 1] = codePoint;
                    return data;
                }
                else {
                    // Replace `[start, end]` with `[startA, endA, startB, endB]`.
                    data.splice(index, 2, start, codePoint, codePoint + 1, end);
                    return data;
                }
            }
            index += 2;
        }
        return data;
    }
    function dataRemoveRange(data, rangeStart, rangeEnd) {
        if (rangeEnd < rangeStart) {
            throw Error(ERRORS.rangeOrder);
        }
        // Iterate over the data per `(start, end)` pair.
        let index = 0;
        let start;
        let end;
        while (index < data.length) {
            start = data[index];
            end = data[index + 1] - 1; // Note: the `- 1` makes `end` inclusive.
            // Exit as soon as no more matching pairs can be found.
            if (start > rangeEnd) {
                return data;
            }
            // Check if this range pair is equal to, or forms a subset of, the range
            // to be removed.
            // E.g. we have `[0, 11, 40, 51]` and want to remove 0-10 → `[40, 51]`.
            // E.g. we have `[40, 51]` and want to remove 0-100 → `[]`.
            if (rangeStart <= start && rangeEnd >= end) {
                // Remove this pair.
                data.splice(index, 2);
                continue;
            }
            // Check if both `rangeStart` and `rangeEnd` are within the bounds of
            // this pair.
            // E.g. we have `[0, 11]` and want to remove 4-6 → `[0, 4, 7, 11]`.
            if (rangeStart >= start && rangeEnd < end) {
                if (rangeStart == start) {
                    // Replace `[start, end]` with `[startB, endB]`.
                    data[index] = rangeEnd + 1;
                    data[index + 1] = end + 1;
                    return data;
                }
                // Replace `[start, end]` with `[startA, endA, startB, endB]`.
                data.splice(index, 2, start, rangeStart, rangeEnd + 1, end + 1);
                return data;
            }
            // Check if only `rangeStart` is within the bounds of this pair.
            // E.g. we have `[0, 11]` and want to remove 4-20 → `[0, 4]`.
            if (rangeStart >= start && rangeStart <= end) {
                // Replace `end` with `rangeStart`.
                data[index + 1] = rangeStart;
                // Note: we cannot `return` just yet, in case any following pairs still
                // contain matching code points.
                // E.g. we have `[0, 11, 14, 31]` and want to remove 4-20
                // → `[0, 4, 21, 31]`.
            }
            // Check if only `rangeEnd` is within the bounds of this pair.
            // E.g. we have `[14, 31]` and want to remove 4-20 → `[21, 31]`.
            else if (rangeEnd >= start && rangeEnd <= end) {
                // Just replace `start`.
                data[index] = rangeEnd + 1;
                return data;
            }
            index += 2;
        }
        return data;
    }
    function dataAdd(data, codePoint) {
        // Iterate over the data per `(start, end)` pair.
        let index = 0;
        let start;
        let end;
        let lastIndex = null;
        let length = data.length;
        if (codePoint < 0x0 || codePoint > 0x10ffff) {
            throw RangeError(ERRORS.codePointRange);
        }
        while (index < length) {
            start = data[index];
            end = data[index + 1];
            // Check if the code point is already in the set.
            if (codePoint >= start && codePoint < end) {
                return data;
            }
            if (codePoint == start - 1) {
                // Just replace `start` with a new value.
                data[index] = codePoint;
                return data;
            }
            // At this point, if `start` is `greater` than `codePoint`, insert a new
            // `[start, end]` pair before the current pair, or after the current pair
            // if there is a known `lastIndex`.
            if (start > codePoint) {
                data.splice(lastIndex != null ? lastIndex + 2 : 0, 0, codePoint, codePoint + 1);
                return data;
            }
            if (codePoint == end) {
                // Check if adding this code point causes two separate ranges to become
                // a single range, e.g. `dataAdd([0, 4, 5, 10], 4)` → `[0, 10]`.
                if (codePoint + 1 == data[index + 2]) {
                    data.splice(index, 4, start, data[index + 3]);
                    return data;
                }
                // Else, just replace `end` with a new value.
                data[index + 1] = codePoint + 1;
                return data;
            }
            lastIndex = index;
            index += 2;
        }
        // The loop has finished; add the new pair to the end of the data set.
        data.push(codePoint, codePoint + 1);
        return data;
    }
    function dataAddData(dataA, dataB) {
        // Iterate over the data per `(start, end)` pair.
        let index = 0;
        let start;
        let end;
        let data = dataA.slice();
        let length = dataB.length;
        while (index < length) {
            start = dataB[index];
            end = dataB[index + 1] - 1;
            if (start == end) {
                data = dataAdd(data, start);
            }
            else {
                data = dataAddRange(data, start, end);
            }
            index += 2;
        }
        return data;
    }
    function dataRemoveData(dataA, dataB) {
        // Iterate over the data per `(start, end)` pair.
        let index = 0;
        let start;
        let end;
        let data = dataA.slice();
        let length = dataB.length;
        while (index < length) {
            start = dataB[index];
            end = dataB[index + 1] - 1;
            if (start == end) {
                data = dataRemove(data, start);
            }
            else {
                data = dataRemoveRange(data, start, end);
            }
            index += 2;
        }
        return data;
    }
    function dataAddRange(data, rangeStart, rangeEnd) {
        if (rangeEnd < rangeStart) {
            throw Error(ERRORS.rangeOrder);
        }
        if (rangeStart < 0x0 ||
            rangeStart > 0x10ffff ||
            rangeEnd < 0x0 ||
            rangeEnd > 0x10ffff) {
            throw RangeError(ERRORS.codePointRange);
        }
        // Iterate over the data per `(start, end)` pair.
        let index = 0;
        let start;
        let end;
        let added = false;
        let length = data.length;
        while (index < length) {
            start = data[index];
            end = data[index + 1];
            if (added) {
                // The range has already been added to the set; at this point, we just
                // need to get rid of the following ranges in case they overlap.
                // Check if this range can be combined with the previous range.
                if (start == rangeEnd + 1) {
                    data.splice(index - 1, 2);
                    return data;
                }
                // Exit as soon as no more possibly overlapping pairs can be found.
                if (start > rangeEnd) {
                    return data;
                }
                // E.g. `[0, 11, 12, 16]` and we’ve added 5-15, so we now have
                // `[0, 16, 12, 16]`. Remove the `12,16` part, as it lies within the
                // `0,16` range that was previously added.
                if (start >= rangeStart && start <= rangeEnd) {
                    // `start` lies within the range that was previously added.
                    if (end > rangeStart && end - 1 <= rangeEnd) {
                        // `end` lies within the range that was previously added as well,
                        // so remove this pair.
                        data.splice(index, 2);
                        index -= 2;
                        // Note: we cannot `return` just yet, as there may still be other
                        // overlapping pairs.
                    }
                    else {
                        // `start` lies within the range that was previously added, but
                        // `end` doesn’t. E.g. `[0, 11, 12, 31]` and we’ve added 5-15, so
                        // now we have `[0, 16, 12, 31]`. This must be written as `[0, 31]`.
                        // Remove the previously added `end` and the current `start`.
                        data.splice(index - 1, 2);
                        index -= 2;
                    }
                    // Note: we cannot return yet.
                }
            }
            else if (start == rangeEnd + 1) {
                data[index] = rangeStart;
                return data;
            }
            // Check if a new pair must be inserted *before* the current one.
            else if (start > rangeEnd) {
                data.splice(index, 0, rangeStart, rangeEnd + 1);
                return data;
            }
            else if (rangeStart >= start && rangeStart < end && rangeEnd + 1 <= end) {
                // The new range lies entirely within an existing range pair. No action
                // needed.
                return data;
            }
            else if (
            // E.g. `[0, 11]` and you add 5-15 → `[0, 16]`.
            (rangeStart >= start && rangeStart < end) ||
                // E.g. `[0, 3]` and you add 3-6 → `[0, 7]`.
                end == rangeStart) {
                // Replace `end` with the new value.
                data[index + 1] = rangeEnd + 1;
                // Make sure the next range pair doesn’t overlap, e.g. `[0, 11, 12, 14]`
                // and you add 5-15 → `[0, 16]`, i.e. remove the `12,14` part.
                added = true;
                // Note: we cannot `return` just yet.
            }
            else if (rangeStart <= start && rangeEnd + 1 >= end) {
                // The new range is a superset of the old range.
                data[index] = rangeStart;
                data[index + 1] = rangeEnd + 1;
                added = true;
            }
            index += 2;
        }
        // The loop has finished without doing anything; add the new pair to the end
        // of the data set.
        if (!added) {
            data.push(rangeStart, rangeEnd + 1);
        }
        return data;
    }
    function dataContains(data, codePoint) {
        let index = 0;
        let length = data.length;
        // Exit early if `codePoint` is not within `data`’s overall range.
        let start = data[index];
        let end = data[length - 1];
        if (length >= 2) {
            if (codePoint < start || codePoint > end) {
                return false;
            }
        }
        // Iterate over the data per `(start, end)` pair.
        while (index < length) {
            start = data[index];
            end = data[index + 1];
            if (codePoint >= start && codePoint < end) {
                return true;
            }
            index += 2;
        }
        return false;
    }
    function dataIntersection(data, codePoints) {
        let index = 0;
        let length = codePoints.length;
        let codePoint;
        let result = [];
        while (index < length) {
            codePoint = codePoints[index];
            if (dataContains(data, codePoint)) {
                result.push(codePoint);
            }
            ++index;
        }
        return dataFromCodePoints(result);
    }
    function dataIsEmpty(data) {
        return !data.length;
    }
    function dataIsSingleton(data) {
        // Check if the set only represents a single code point.
        return data.length == 2 && data[0] + 1 == data[1];
    }
    function dataToArray(data) {
        // Iterate over the data per `(start, end)` pair.
        let index = 0;
        let start;
        let end;
        let result = [];
        let length = data.length;
        while (index < length) {
            start = data[index];
            end = data[index + 1];
            while (start < end) {
                result.push(start);
                ++start;
            }
            index += 2;
        }
        return result;
    }
    /*--------------------------------------------------------------------------*/
    // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
    const floor = Math.floor;
    function highSurrogate(codePoint) {
        return parseInt(`${floor((codePoint - 0x10000) / 0x400) + HIGH_SURROGATE_MIN}`, 10);
    }
    function lowSurrogate(codePoint) {
        return parseInt(`${((codePoint - 0x10000) % 0x400) + LOW_SURROGATE_MIN}`, 10);
    }
    const stringFromCharCode = String.fromCharCode;
    function codePointToString(codePoint) {
        let string;
        // https://mathiasbynens.be/notes/javascript-escapes#single
        // Note: the `\b` escape sequence for U+0008 BACKSPACE in strings has a
        // different meaning in regular expressions (word boundary), so it cannot
        // be used here.
        if (codePoint == 0x09) {
            string = "\\t";
        }
        // Note: IE < 9 treats `'\v'` as `'v'`, so avoid using it.
        // else if (codePoint == 0x0B) {
        // 	string = '\\v';
        // }
        else if (codePoint == 0x0a) {
            string = "\\n";
        }
        else if (codePoint == 0x0c) {
            string = "\\f";
        }
        else if (codePoint == 0x0d) {
            string = "\\r";
        }
        else if (codePoint == 0x2d) {
            // https://mathiasbynens.be/notes/javascript-escapes#hexadecimal
            // Note: `-` (U+002D HYPHEN-MINUS) is escaped in this way rather
            // than by backslash-escaping, in case the output is used outside
            // of a character class in a `u` RegExp. /\-/u throws, but
            // /\x2D/u is fine.
            string = "\\x2D";
        }
        else if (codePoint == 0x5c) {
            string = "\\\\";
        }
        else if (codePoint == 0x24 ||
            (codePoint >= 0x28 && codePoint <= 0x2b) ||
            codePoint == 0x2e ||
            codePoint == 0x2f ||
            codePoint == 0x3f ||
            (codePoint >= 0x5b && codePoint <= 0x5e) ||
            (codePoint >= 0x7b && codePoint <= 0x7d)) {
            // The code point maps to an unsafe printable ASCII character;
            // backslash-escape it. Here’s the list of those symbols:
            //
            //     $()*+./?[\]^{|}
            //
            // This matches SyntaxCharacters as well as `/` (U+002F SOLIDUS).
            // https://tc39.github.io/ecma262/#prod-SyntaxCharacter
            string = "\\" + stringFromCharCode(codePoint);
        }
        else if (codePoint >= 0x20 && codePoint <= 0x7e) {
            // The code point maps to one of these printable ASCII symbols
            // (including the space character):
            //
            //      !"#%&',/0123456789:;<=>@ABCDEFGHIJKLMNO
            //     PQRSTUVWXYZ_`abcdefghijklmnopqrstuvwxyz~
            //
            // These can safely be used directly.
            string = stringFromCharCode(codePoint);
        }
        else if (codePoint <= 0xff) {
            string = "\\x" + pad(hex(codePoint), 2);
        }
        else {
            // `codePoint <= 0xFFFF` holds true.
            // https://mathiasbynens.be/notes/javascript-escapes#unicode
            string = "\\u" + pad(hex(codePoint), 4);
        }
        // There’s no need to account for astral symbols / surrogate pairs here,
        // since `codePointToString` is private and only used for BMP code points.
        // But if that’s what you need, just add an `else` block with this code:
        //
        //     string = '\\u' + pad(hex(highSurrogate(codePoint)), 4)
        //     	+ '\\u' + pad(hex(lowSurrogate(codePoint)), 4);
        return string;
    }
    function codePointToStringUnicode(codePoint) {
        if (codePoint <= 0xffff) {
            return codePointToString(codePoint);
        }
        return "\\u{" + codePoint.toString(16).toUpperCase() + "}";
    }
    function symbolToCodePoint(symbol) {
        let length = symbol.length;
        let first = symbol.charCodeAt(0);
        let second;
        if (first >= HIGH_SURROGATE_MIN &&
            first <= HIGH_SURROGATE_MAX &&
            length > 1 // There is a next code unit.
        ) {
            // `first` is a high surrogate, and there is a next character. Assume
            // it’s a low surrogate (else it’s invalid usage of Regenerate anyway).
            second = symbol.charCodeAt(1);
            // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
            return ((first - HIGH_SURROGATE_MIN) * 0x400 +
                second -
                LOW_SURROGATE_MIN +
                0x10000);
        }
        return first;
    }
    function createBMPCharacterClasses(data) {
        // Iterate over the data per `(start, end)` pair.
        let result = "";
        let index = 0;
        let start;
        let end;
        let length = data.length;
        if (dataIsSingleton(data)) {
            return codePointToString(data[0]);
        }
        while (index < length) {
            start = data[index];
            end = data[index + 1] - 1; // Note: the `- 1` makes `end` inclusive.
            if (start == end) {
                result += codePointToString(start);
            }
            else if (start + 1 == end) {
                result += codePointToString(start) + codePointToString(end);
            }
            else {
                result += codePointToString(start) + "-" + codePointToString(end);
            }
            index += 2;
        }
        return "[" + result + "]";
    }
    function createUnicodeCharacterClasses(data) {
        // Iterate over the data per `(start, end)` pair.
        let result = "";
        let index = 0;
        let start;
        let end;
        let length = data.length;
        if (dataIsSingleton(data)) {
            return codePointToStringUnicode(data[0]);
        }
        while (index < length) {
            start = data[index];
            end = data[index + 1] - 1; // Note: the `- 1` makes `end` inclusive.
            if (start == end) {
                result += codePointToStringUnicode(start);
            }
            else if (start + 1 == end) {
                result += codePointToStringUnicode(start) + codePointToStringUnicode(end);
            }
            else {
                result +=
                    codePointToStringUnicode(start) + "-" + codePointToStringUnicode(end);
            }
            index += 2;
        }
        return "[" + result + "]";
    }
    function splitAtBMP(data) {
        // Iterate over the data per `(start, end)` pair.
        let loneHighSurrogates = [];
        let loneLowSurrogates = [];
        let bmp = [];
        let astral = [];
        let index = 0;
        let start;
        let end;
        let length = data.length;
        while (index < length) {
            start = data[index];
            end = data[index + 1] - 1; // Note: the `- 1` makes `end` inclusive.
            if (start < HIGH_SURROGATE_MIN) {
                // The range starts and ends before the high surrogate range.
                // E.g. (0, 0x10).
                if (end < HIGH_SURROGATE_MIN) {
                    bmp.push(start, end + 1);
                }
                // The range starts before the high surrogate range and ends within it.
                // E.g. (0, 0xD855).
                if (end >= HIGH_SURROGATE_MIN && end <= HIGH_SURROGATE_MAX) {
                    bmp.push(start, HIGH_SURROGATE_MIN);
                    loneHighSurrogates.push(HIGH_SURROGATE_MIN, end + 1);
                }
                // The range starts before the high surrogate range and ends in the low
                // surrogate range. E.g. (0, 0xDCFF).
                if (end >= LOW_SURROGATE_MIN && end <= LOW_SURROGATE_MAX) {
                    bmp.push(start, HIGH_SURROGATE_MIN);
                    loneHighSurrogates.push(HIGH_SURROGATE_MIN, HIGH_SURROGATE_MAX + 1);
                    loneLowSurrogates.push(LOW_SURROGATE_MIN, end + 1);
                }
                // The range starts before the high surrogate range and ends after the
                // low surrogate range. E.g. (0, 0x10FFFF).
                if (end > LOW_SURROGATE_MAX) {
                    bmp.push(start, HIGH_SURROGATE_MIN);
                    loneHighSurrogates.push(HIGH_SURROGATE_MIN, HIGH_SURROGATE_MAX + 1);
                    loneLowSurrogates.push(LOW_SURROGATE_MIN, LOW_SURROGATE_MAX + 1);
                    if (end <= 0xffff) {
                        bmp.push(LOW_SURROGATE_MAX + 1, end + 1);
                    }
                    else {
                        bmp.push(LOW_SURROGATE_MAX + 1, 0xffff + 1);
                        astral.push(0xffff + 1, end + 1);
                    }
                }
            }
            else if (start >= HIGH_SURROGATE_MIN && start <= HIGH_SURROGATE_MAX) {
                // The range starts and ends in the high surrogate range.
                // E.g. (0xD855, 0xD866).
                if (end >= HIGH_SURROGATE_MIN && end <= HIGH_SURROGATE_MAX) {
                    loneHighSurrogates.push(start, end + 1);
                }
                // The range starts in the high surrogate range and ends in the low
                // surrogate range. E.g. (0xD855, 0xDCFF).
                if (end >= LOW_SURROGATE_MIN && end <= LOW_SURROGATE_MAX) {
                    loneHighSurrogates.push(start, HIGH_SURROGATE_MAX + 1);
                    loneLowSurrogates.push(LOW_SURROGATE_MIN, end + 1);
                }
                // The range starts in the high surrogate range and ends after the low
                // surrogate range. E.g. (0xD855, 0x10FFFF).
                if (end > LOW_SURROGATE_MAX) {
                    loneHighSurrogates.push(start, HIGH_SURROGATE_MAX + 1);
                    loneLowSurrogates.push(LOW_SURROGATE_MIN, LOW_SURROGATE_MAX + 1);
                    if (end <= 0xffff) {
                        bmp.push(LOW_SURROGATE_MAX + 1, end + 1);
                    }
                    else {
                        bmp.push(LOW_SURROGATE_MAX + 1, 0xffff + 1);
                        astral.push(0xffff + 1, end + 1);
                    }
                }
            }
            else if (start >= LOW_SURROGATE_MIN && start <= LOW_SURROGATE_MAX) {
                // The range starts and ends in the low surrogate range.
                // E.g. (0xDCFF, 0xDDFF).
                if (end >= LOW_SURROGATE_MIN && end <= LOW_SURROGATE_MAX) {
                    loneLowSurrogates.push(start, end + 1);
                }
                // The range starts in the low surrogate range and ends after the low
                // surrogate range. E.g. (0xDCFF, 0x10FFFF).
                if (end > LOW_SURROGATE_MAX) {
                    loneLowSurrogates.push(start, LOW_SURROGATE_MAX + 1);
                    if (end <= 0xffff) {
                        bmp.push(LOW_SURROGATE_MAX + 1, end + 1);
                    }
                    else {
                        bmp.push(LOW_SURROGATE_MAX + 1, 0xffff + 1);
                        astral.push(0xffff + 1, end + 1);
                    }
                }
            }
            else if (start > LOW_SURROGATE_MAX && start <= 0xffff) {
                // The range starts and ends after the low surrogate range.
                // E.g. (0xFFAA, 0x10FFFF).
                if (end <= 0xffff) {
                    bmp.push(start, end + 1);
                }
                else {
                    bmp.push(start, 0xffff + 1);
                    astral.push(0xffff + 1, end + 1);
                }
            }
            else {
                // The range starts and ends in the astral range.
                astral.push(start, end + 1);
            }
            index += 2;
        }
        return {
            loneHighSurrogates: loneHighSurrogates,
            loneLowSurrogates: loneLowSurrogates,
            bmp: bmp,
            astral: astral
        };
    }
    function optimizeSurrogateMappings(surrogateMappings) {
        let result = [];
        let tmpLow = [];
        let addLow = false;
        let mapping;
        let nextMapping;
        let highSurrogates;
        let lowSurrogates;
        let nextHighSurrogates;
        let nextLowSurrogates;
        let index = -1;
        let length = surrogateMappings.length;
        while (++index < length) {
            mapping = surrogateMappings[index];
            nextMapping = surrogateMappings[index + 1];
            if (!nextMapping) {
                result.push(mapping);
                continue;
            }
            highSurrogates = mapping[0];
            lowSurrogates = mapping[1];
            nextHighSurrogates = nextMapping[0];
            nextLowSurrogates = nextMapping[1];
            // Check for identical high surrogate ranges.
            tmpLow = lowSurrogates;
            while (nextHighSurrogates &&
                highSurrogates[0] == nextHighSurrogates[0] &&
                highSurrogates[1] == nextHighSurrogates[1]) {
                // Merge with the next item.
                if (dataIsSingleton(nextLowSurrogates)) {
                    tmpLow = dataAdd(tmpLow, nextLowSurrogates[0]);
                }
                else {
                    tmpLow = dataAddRange(tmpLow, nextLowSurrogates[0], nextLowSurrogates[1] - 1);
                }
                ++index;
                mapping = surrogateMappings[index];
                highSurrogates = mapping[0];
                lowSurrogates = mapping[1];
                nextMapping = surrogateMappings[index + 1];
                nextHighSurrogates = nextMapping && nextMapping[0];
                nextLowSurrogates = nextMapping && nextMapping[1];
                addLow = true;
            }
            result.push([highSurrogates, addLow ? tmpLow : lowSurrogates]);
            addLow = false;
        }
        return optimizeByLowSurrogates(result);
    }
    function optimizeByLowSurrogates(surrogateMappings) {
        if (surrogateMappings.length == 1) {
            return surrogateMappings;
        }
        let index = -1;
        let innerIndex = -1;
        while (++index < surrogateMappings.length) {
            let mapping = surrogateMappings[index];
            let lowSurrogates = mapping[1];
            let lowSurrogateStart = lowSurrogates[0];
            let lowSurrogateEnd = lowSurrogates[1];
            innerIndex = index; // Note: the loop starts at the next index.
            while (++innerIndex < surrogateMappings.length) {
                let otherMapping = surrogateMappings[innerIndex];
                let otherLowSurrogates = otherMapping[1];
                let otherLowSurrogateStart = otherLowSurrogates[0];
                let otherLowSurrogateEnd = otherLowSurrogates[1];
                if (lowSurrogateStart == otherLowSurrogateStart &&
                    lowSurrogateEnd == otherLowSurrogateEnd) {
                    // Add the code points in the other item to this one.
                    if (dataIsSingleton(otherMapping[0])) {
                        mapping[0] = dataAdd(mapping[0], otherMapping[0][0]);
                    }
                    else {
                        mapping[0] = dataAddRange(mapping[0], otherMapping[0][0], otherMapping[0][1] - 1);
                    }
                    // Remove the other, now redundant, item.
                    surrogateMappings.splice(innerIndex, 1);
                    --innerIndex;
                }
            }
        }
        return surrogateMappings;
    }
    function surrogateSet(data) {
        // Exit early if `data` is an empty set.
        if (!data.length) {
            return [];
        }
        // Iterate over the data per `(start, end)` pair.
        let index = 0;
        let start;
        let end;
        let startHigh;
        let startLow;
        let endHigh;
        let endLow;
        let surrogateMappings = [];
        let length = data.length;
        while (index < length) {
            start = data[index];
            end = data[index + 1] - 1;
            startHigh = highSurrogate(start);
            startLow = lowSurrogate(start);
            endHigh = highSurrogate(end);
            endLow = lowSurrogate(end);
            let startsWithLowestLowSurrogate = startLow == LOW_SURROGATE_MIN;
            let endsWithHighestLowSurrogate = endLow == LOW_SURROGATE_MAX;
            let complete = false;
            // Append the previous high-surrogate-to-low-surrogate mappings.
            // Step 1: `(startHigh, startLow)` to `(startHigh, LOW_SURROGATE_MAX)`.
            if (startHigh == endHigh ||
                (startsWithLowestLowSurrogate && endsWithHighestLowSurrogate)) {
                surrogateMappings.push([
                    [startHigh, endHigh + 1],
                    [startLow, endLow + 1]
                ]);
                complete = true;
            }
            else {
                surrogateMappings.push([
                    [startHigh, startHigh + 1],
                    [startLow, LOW_SURROGATE_MAX + 1]
                ]);
            }
            // Step 2: `(startHigh + 1, LOW_SURROGATE_MIN)` to
            // `(endHigh - 1, LOW_SURROGATE_MAX)`.
            if (!complete && startHigh + 1 < endHigh) {
                if (endsWithHighestLowSurrogate) {
                    // Combine step 2 and step 3.
                    surrogateMappings.push([
                        [startHigh + 1, endHigh + 1],
                        [LOW_SURROGATE_MIN, endLow + 1]
                    ]);
                    complete = true;
                }
                else {
                    surrogateMappings.push([
                        [startHigh + 1, endHigh],
                        [LOW_SURROGATE_MIN, LOW_SURROGATE_MAX + 1]
                    ]);
                }
            }
            // Step 3. `(endHigh, LOW_SURROGATE_MIN)` to `(endHigh, endLow)`.
            if (!complete) {
                surrogateMappings.push([
                    [endHigh, endHigh + 1],
                    [LOW_SURROGATE_MIN, endLow + 1]
                ]);
            }
            index += 2;
        }
        // The format of `surrogateMappings` is as follows:
        //
        //     [ surrogateMapping1, surrogateMapping2 ]
        //
        // i.e.:
        //
        //     [
        //       [ highSurrogates1, lowSurrogates1 ],
        //       [ highSurrogates2, lowSurrogates2 ]
        //     ]
        return optimizeSurrogateMappings(surrogateMappings);
    }
    function createSurrogateCharacterClasses(surrogateMappings) {
        const result = surrogateMappings.map(surrogateMapping => {
            let highSurrogates = surrogateMapping[0];
            let lowSurrogates = surrogateMapping[1];
            return [
                createBMPCharacterClasses(highSurrogates) +
                    createBMPCharacterClasses(lowSurrogates)
            ];
        });
        return result.join("|");
    }
    function createCharacterClassesFromData(data, bmpOnly, hasUnicodeFlag) {
        if (hasUnicodeFlag) {
            return createUnicodeCharacterClasses(data);
        }
        let result = [];
        let parts = splitAtBMP(data);
        let loneHighSurrogates = parts.loneHighSurrogates;
        let loneLowSurrogates = parts.loneLowSurrogates;
        let bmp = parts.bmp;
        let astral = parts.astral;
        let hasLoneHighSurrogates = !dataIsEmpty(loneHighSurrogates);
        let hasLoneLowSurrogates = !dataIsEmpty(loneLowSurrogates);
        let surrogateMappings = surrogateSet(astral);
        if (bmpOnly) {
            bmp = dataAddData(bmp, loneHighSurrogates);
            hasLoneHighSurrogates = false;
            bmp = dataAddData(bmp, loneLowSurrogates);
            hasLoneLowSurrogates = false;
        }
        if (!dataIsEmpty(bmp)) {
            // The data set contains BMP code points that are not high surrogates
            // needed for astral code points in the set.
            result.push(createBMPCharacterClasses(bmp));
        }
        if (surrogateMappings.length) {
            // The data set contains astral code points; append character classes
            // based on their surrogate pairs.
            result.push(createSurrogateCharacterClasses(surrogateMappings));
        }
        // https://gist.github.com/mathiasbynens/bbe7f870208abcfec860
        if (hasLoneHighSurrogates) {
            result.push(createBMPCharacterClasses(loneHighSurrogates) +
                // Make sure the high surrogates aren’t part of a surrogate pair.
                "(?![\\uDC00-\\uDFFF])");
        }
        if (hasLoneLowSurrogates) {
            result.push(
            // It is not possible to accurately assert the low surrogates aren’t
            // part of a surrogate pair, since JavaScript regular expressions do
            // not support lookbehind.
            "(?:[^\\uD800-\\uDBFF]|^)" + createBMPCharacterClasses(loneLowSurrogates));
        }
        return result.join("|");
    }
    class Regenerate {
        constructor(...args) {
            this.version = "2.0.0";
            this.data = [];
            if (args.length > 0) {
                args.forEach(item => this.add(item));
            }
        }
        /** Adds arguments to the set */
        add(...args) {
            //if (value instanceof Regenerate) {
            //  // Allow passing other Regenerate instances.
            //  this.data = dataAddData(this.data, value.data);      
            //  return this;
            //}
            args.forEach(item => {
                if (Array.isArray(item)) {
                    item.forEach((subItem) => {
                        this.data = dataAdd(this.data, isNumber(subItem) ? subItem : symbolToCodePoint(subItem.toString()));
                    });
                }
                else {
                    this.data = dataAdd(this.data, isNumber(item) ? item : symbolToCodePoint(item.toString()));
                }
            });
            return this;
        }
        /** Adds a range of code points from `start` to `end` (inclusive) to the set. */
        addRange(start, end) {
            this.data = dataAddRange(this.data, isNumber(start) ? start : symbolToCodePoint(start), isNumber(end) ? end : symbolToCodePoint(end));
            return this;
        }
        /** Removes arguments from the set */
        remove(value, ...args) {
            if (!value) {
                return this;
            }
            if (value instanceof Regenerate) {
                // Allow passing other Regenerate instances.
                this.data = dataRemoveData(this.data, value.data);
                return this;
            }
            if (arguments.length > 1) {
                value = slice.call(arguments);
            }
            if (Array.isArray(value)) {
                value.forEach((item) => {
                    this.remove(item);
                });
                return this;
            }
            this.data = dataRemove(this.data, (typeof value === "number") ? value : symbolToCodePoint(value.toString()));
            return this;
        }
        /** Removes a range of code points from `start` to `end` (inclusive) from the set. */
        removeRange(start, end) {
            let startCodePoint = isNumber(start) ? start : symbolToCodePoint(start);
            let endCodePoint = isNumber(end) ? end : symbolToCodePoint(end);
            this.data = dataRemoveRange(this.data, startCodePoint, endCodePoint);
            return this;
        }
        /** Removes any code points from the set that are not present in both the set and the given values */
        intersection(values) {
            // Allow passing other Regenerate instances.
            // TODO: Optimize this by writing and using `dataIntersectionData()`.
            let array = values instanceof Regenerate ? dataToArray(values.data) : values;
            this.data = dataIntersection(this.data, array);
            return this;
        }
        /** Returns `true` if the given value is part of the set, and `false` otherwise. */
        contains(value) {
            let ret = false;
            const codePoint = (typeof value === 'number') ? value : symbolToCodePoint(value);
            ret = dataContains(this.data, codePoint);
            return ret;
        }
        /** Returns a clone of the current code point set. Any actions performed on the clone won’t mutate the original set. */
        clone() {
            const set = new Regenerate();
            set.data = this.data.map(v => v);
            return set;
        }
        toArray() {
            return this.valueOf();
        }
        toString(options) {
            options = { ...{ bmpOnly: false, hasUnicodeFlag: false }, ...options };
            let result = createCharacterClassesFromData(this.data, options.bmpOnly, options.hasUnicodeFlag);
            if (!result) {
                // For an empty set, return something that can be inserted `/here/` to
                // form a valid regular expression. Avoid `(?:)` since that matches the
                // empty string.
                return "[]";
            }
            // Use `\0` instead of `\x00` where possible.
            return result.replace(regexNull, "\\0$1");
        }
        toRegExp(flags = "") {
            let pattern = this.toString(flags && flags.indexOf("u") != -1 ? { hasUnicodeFlag: true } : undefined);
            return RegExp(pattern, flags);
        }
        valueOf() {
            // Note: `valueOf` is aliased as `toArray`.
            return dataToArray(this.data);
        }
    }
    exports.Regenerate = Regenerate;
    exports.default = (...args) => {
        let ret = new Regenerate();
        if (args.length > 0) {
            args.forEach(arg => {
                ret = ret.add(arg);
            });
        }
        return ret;
    };
});
define("https://raw.githubusercontent.com/stevedorries/jsesc/master/src/deps", ["require", "exports", "https://raw.githubusercontent.com/stevedorries/regenerate/master/regenerate"], function (require, exports, regenerate_ts_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.regenerate = regenerate_ts_1.default;
    exports.Regenerate = regenerate_ts_1.Regenerate;
});
define("https://raw.githubusercontent.com/stevedorries/jsesc/master/src/data", ["require", "exports", "https://raw.githubusercontent.com/stevedorries/jsesc/master/src/deps"], function (require, exports, deps_ts_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.whitelist = deps_ts_1.regenerate()
        .addRange(0x20, 0x7e) // printable ASCII symbols
        .remove('"') // not `"`
        .remove("'") // not `'`
        .remove("\\") // not `\`
        .remove("`") // not '`'
        .toString();
    exports.version = "1.0.0";
});
define("https://raw.githubusercontent.com/stevedorries/jsesc/master/src/jsesc", ["require", "exports", "https://raw.githubusercontent.com/stevedorries/jsesc/master/src/data"], function (require, exports, data_ts_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const Buffer = Deno.Buffer;
    const object = {};
    const hasOwnProperty = object.hasOwnProperty;
    const forOwn = (object, callback) => {
        for (const key in object) {
            if (hasOwnProperty.call(object, key)) {
                callback(key, object[key]);
            }
        }
    };
    const extend = (destination, source) => {
        if (!source) {
            return destination;
        }
        forOwn(source, (key, value) => {
            destination[key] = value;
        });
        return destination;
    };
    const forEach = (array, callback) => {
        const length = array.length;
        let index = -1;
        while (++index < length) {
            callback(array[index]);
        }
    };
    const toString = object.toString;
    const isArray = Array.isArray;
    const isObject = (value) => {
        // This is a very simple check, but it’s good enough for what we need.
        return toString.call(value) == "[object Object]";
    };
    const isString = (value) => {
        return typeof value == "string" || toString.call(value) == "[object String]";
    };
    const isNumber = (value) => {
        return typeof value == "number" || toString.call(value) == "[object Number]";
    };
    const isFunction = (value) => {
        return typeof value == "function";
    };
    const isMap = (value) => {
        return toString.call(value) == "[object Map]";
    };
    const isSet = (value) => {
        return toString.call(value) == "[object Set]";
    };
    function isNotNullOrUndefined(value) {
        return value !== null && value !== undefined;
    }
    /*--------------------------------------------------------------------------*/
    // https://mathiasbynens.be/notes/javascript-escapes#single
    const singleEscapes = {
        '"': '\\"',
        "'": "\\'",
        "\\": "\\\\",
        "\b": "\\b",
        "\f": "\\f",
        "\n": "\\n",
        "\r": "\\r",
        "\t": "\\t"
        // `\v` is omitted intentionally, because in IE < 9, '\v' == 'v'.
        // '\v': '\\x0B'
    };
    const regexSingleEscape = /["'\\\b\f\n\r\t]/;
    const regexDigit = /[0-9]/;
    exports.regexWhitelist = new RegExp(data_ts_1.whitelist);
    const defaultOptions = {
        compact: true,
        numbers: "decimal",
        indent: "\t",
        indentLevel: 0,
        __inline1__: false,
        __inline2__: false
    };
    exports.jsesc = (argument, options = defaultOptions) => {
        // Handle options
        const opts = { ...defaultOptions, ...options };
        let indent = opts.indent.repeat(opts.indentLevel);
        let oldIndent = "";
        const increaseIndentation = () => {
            oldIndent = indent;
            ++opts.indentLevel;
            indent = opts.indent.repeat(opts.indentLevel);
        };
        const json = opts.json;
        let wrap = false;
        let quote = opts.quotes === "single" ? "'" : opts.quotes === "backtick" ? "`" : '"';
        if (json) {
            wrap = true;
        }
        if (opts.wrap !== undefined) {
            wrap = opts.wrap;
        }
        const compact = opts.compact === true;
        const lowercaseHex = opts.lowercaseHex === true;
        const inline1 = opts.__inline1__;
        const inline2 = opts.__inline2__;
        const newLine = compact ? "" : "\n";
        let result = "";
        let isEmpty = true;
        const useBinNumbers = opts.numbers == "binary";
        const useOctNumbers = opts.numbers == "octal";
        const useDecNumbers = opts.numbers == "decimal";
        const useHexNumbers = opts.numbers == "hexadecimal";
        if (json && isNotNullOrUndefined(argument) && isFunction(argument.toJSON)) {
            argument = argument.toJSON();
        }
        if (!isString(argument)) {
            if (isMap(argument)) {
                if (argument.size == 0) {
                    return "new Map()";
                }
                if (!compact) {
                    opts.__inline1__ = true;
                    opts.__inline2__ = false;
                }
                return "new Map(" + exports.jsesc(Array.from(argument), opts) + ")";
            }
            if (isSet(argument)) {
                if (argument.size == 0) {
                    return "new Set()";
                }
                return "new Set(" + exports.jsesc(Array.from(argument), opts) + ")";
            }
            if (isArray(argument)) {
                let res = [];
                opts.wrap = true;
                if (inline1) {
                    opts.__inline1__ = false;
                    opts.__inline2__ = true;
                }
                if (!inline2) {
                    increaseIndentation();
                }
                forEach(argument, value => {
                    isEmpty = false;
                    if (inline2) {
                        opts.__inline2__ = false;
                    }
                    res.push((compact || inline2 ? "" : indent) + exports.jsesc(value, opts));
                });
                if (isEmpty) {
                    return "[]";
                }
                if (inline2) {
                    return "[" + res.join(", ") + "]";
                }
                return ("[" +
                    newLine +
                    res.join("," + newLine) +
                    newLine +
                    (compact ? "" : oldIndent) +
                    "]");
            }
            if (isNumber(argument)) {
                if (json) {
                    // Some number values (e.g. `Infinity`) cannot be represented in JSON.
                    return JSON.stringify(argument);
                }
                if (useDecNumbers) {
                    return String(argument);
                }
                if (useHexNumbers) {
                    let hexadecimal = argument.toString(16);
                    if (!lowercaseHex) {
                        hexadecimal = hexadecimal.toUpperCase();
                    }
                    return "0x" + hexadecimal;
                }
                if (useBinNumbers) {
                    return "0b" + argument.toString(2);
                }
                if (useOctNumbers) {
                    return "0o" + argument.toString(8);
                }
            }
            if (!isObject(argument)) {
                if (json) {
                    // For some values (e.g. `undefined`, `function` objects),
                    // `JSON.stringify(value)` returns `undefined` (which isn’t valid
                    // JSON) instead of `'null'`.
                    return JSON.stringify(argument) || "null";
                }
                return String(argument);
            }
            else {
                // it’s an object
                let res = [];
                opts.wrap = true;
                increaseIndentation();
                forOwn(argument, (key, value) => {
                    isEmpty = false;
                    res.push((compact ? "" : indent) +
                        exports.jsesc(key, opts) +
                        ":" +
                        (compact ? "" : " ") +
                        exports.jsesc(value, opts));
                });
                if (isEmpty) {
                    return "{}";
                }
                return ("{" +
                    newLine +
                    res.join("," + newLine) +
                    newLine +
                    (compact ? "" : oldIndent) +
                    "}");
            }
        }
        else {
            const string = argument.toString();
            // Loop over each code unit in the string and escape it
            let index = -1;
            const length = string.length;
            result = "";
            while (++index < length) {
                const character = string.charAt(index);
                if (opts.es6) {
                    const first = string.charCodeAt(index);
                    if (
                    // check if it’s the start of a surrogate pair
                    first >= 0xd800 &&
                        first <= 0xdbff && // high surrogate
                        length > index + 1 // there is a next code unit
                    ) {
                        const second = string.charCodeAt(index + 1);
                        if (second >= 0xdc00 && second <= 0xdfff) {
                            // low surrogate
                            // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
                            const codePoint = (first - 0xd800) * 0x400 + second - 0xdc00 + 0x10000;
                            let hexadecimal = codePoint.toString(16);
                            if (!lowercaseHex) {
                                hexadecimal = hexadecimal.toUpperCase();
                            }
                            result += "\\u{" + hexadecimal + "}";
                            ++index;
                            continue;
                        }
                    }
                }
                if (!opts.escapeEverything) {
                    if (exports.regexWhitelist.test(character)) {
                        // It’s a printable ASCII character that is not `"`, `'` or `\`,
                        // so don’t escape it.
                        result += character;
                        continue;
                    }
                    if (character == '"') {
                        result += quote == character ? '\\"' : character;
                        continue;
                    }
                    if (character == "`") {
                        result += quote == character ? "\\`" : character;
                        continue;
                    }
                    if (character == "'") {
                        result += quote == character ? "\\'" : character;
                        continue;
                    }
                }
                if (character == "\0" &&
                    !json &&
                    !regexDigit.test(string.charAt(index + 1))) {
                    result += "\\0";
                    continue;
                }
                if (regexSingleEscape.test(character)) {
                    // no need for a `hasOwnProperty` check here
                    result += singleEscapes[character];
                    continue;
                }
                const charCode = character.charCodeAt(0);
                if (opts.minimal && charCode != 0x2028 && charCode != 0x2029) {
                    result += character;
                    continue;
                }
                let hexadecimal = charCode.toString(16);
                if (!lowercaseHex) {
                    hexadecimal = hexadecimal.toUpperCase();
                }
                const longhand = hexadecimal.length > 2 || json;
                const escaped = "\\" +
                    (longhand ? "u" : "x") +
                    ("0000" + hexadecimal).slice(longhand ? -4 : -2);
                result += escaped;
                continue;
            }
            if (wrap === true) {
                result = quote + result + quote;
            }
            if (quote == "`") {
                result = result.replace(/\$\{/g, "\\${");
            }
            if (opts.isScriptContext) {
                // https://mathiasbynens.be/notes/etago
                return result
                    .replace(/<\/(script|style)/gi, "<\\/$1")
                    .replace(/<!--/g, json ? "\\u003C!--" : "\\x3C!--");
            }
        }
        return result;
    };
    exports.jsesc.version = data_ts_1.version;
});
define("https://raw.githubusercontent.com/stevedorries/jsesc/master/mod", ["require", "exports", "https://raw.githubusercontent.com/stevedorries/jsesc/master/src/jsesc"], function (require, exports, jsesc_ts_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.jsesc = jsesc_ts_1.jsesc;
});
define("file:///home/sdorries/repos/github/he/src/deps", ["require", "exports", "https://raw.githubusercontent.com/stevedorries/regenerate/master/regenerate", "https://raw.githubusercontent.com/stevedorries/jsesc/master/mod"], function (require, exports, regenerate_ts_2, mod_ts_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.regenerate = regenerate_ts_2.default;
    exports.Regenerate = regenerate_ts_2.Regenerate;
    exports.jsesc = mod_ts_1.jsesc;
    /**
     *
     * @return {Array<?>} the values from array that are not present in the other arrays
     */
    function difference(first, second) {
        const arrays = [first, second];
        return arrays.reduce((a, b) => a.filter(c => !b.includes(c)));
    }
    exports.difference = difference;
    /** Returns a new array with duplicate entries removed */
    function uniq(value) {
        return [...new Set(value)];
    }
    exports.uniq = uniq;
});
define("file:///home/sdorries/repos/github/he/src/data/regex-ascii-whitelist", [], "[\\0-\\x7F]");
define("file:///home/sdorries/repos/github/he/src/data/regex-astral-symbol", [], "[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]");
define("file:///home/sdorries/repos/github/he/src/data/regex-bmp-whitelist", [], "[\\0-\\t\\x0B\\f\\x0E-\\x1F\\x7F\\x81\\x8D\\x8F\\x90\\x9D\\xA0-\\uFFFF]");
define("file:///home/sdorries/repos/github/he/src/data/regex-encode-non-ascii", [], "<\\u20D2|=\\u20E5|>\\u20D2|\\u205F\\u200A|\\u219D\\u0338|\\u2202\\u0338|\\u2220\\u20D2|\\u2229\\uFE00|\\u222A\\uFE00|\\u223C\\u20D2|\\u223D\\u0331|\\u223E\\u0333|\\u2242\\u0338|\\u224B\\u0338|\\u224D\\u20D2|\\u224E\\u0338|\\u224F\\u0338|\\u2250\\u0338|\\u2261\\u20E5|\\u2264\\u20D2|\\u2265\\u20D2|\\u2266\\u0338|\\u2267\\u0338|\\u2268\\uFE00|\\u2269\\uFE00|\\u226A\\u0338|\\u226A\\u20D2|\\u226B\\u0338|\\u226B\\u20D2|\\u227F\\u0338|\\u2282\\u20D2|\\u2283\\u20D2|\\u228A\\uFE00|\\u228B\\uFE00|\\u228F\\u0338|\\u2290\\u0338|\\u2293\\uFE00|\\u2294\\uFE00|\\u22B4\\u20D2|\\u22B5\\u20D2|\\u22D8\\u0338|\\u22D9\\u0338|\\u22DA\\uFE00|\\u22DB\\uFE00|\\u22F5\\u0338|\\u22F9\\u0338|\\u2933\\u0338|\\u29CF\\u0338|\\u29D0\\u0338|\\u2A6D\\u0338|\\u2A70\\u0338|\\u2A7D\\u0338|\\u2A7E\\u0338|\\u2AA1\\u0338|\\u2AA2\\u0338|\\u2AAC\\uFE00|\\u2AAD\\uFE00|\\u2AAF\\u0338|\\u2AB0\\u0338|\\u2AC5\\u0338|\\u2AC6\\u0338|\\u2ACB\\uFE00|\\u2ACC\\uFE00|\\u2AFD\\u20E5|[\\xA0-\\u0113\\u0116-\\u0122\\u0124-\\u012B\\u012E-\\u014D\\u0150-\\u017E\\u0192\\u01B5\\u01F5\\u0237\\u02C6\\u02C7\\u02D8-\\u02DD\\u0311\\u0391-\\u03A1\\u03A3-\\u03A9\\u03B1-\\u03C9\\u03D1\\u03D2\\u03D5\\u03D6\\u03DC\\u03DD\\u03F0\\u03F1\\u03F5\\u03F6\\u0401-\\u040C\\u040E-\\u044F\\u0451-\\u045C\\u045E\\u045F\\u2002-\\u2005\\u2007-\\u2010\\u2013-\\u2016\\u2018-\\u201A\\u201C-\\u201E\\u2020-\\u2022\\u2025\\u2026\\u2030-\\u2035\\u2039\\u203A\\u203E\\u2041\\u2043\\u2044\\u204F\\u2057\\u205F-\\u2063\\u20AC\\u20DB\\u20DC\\u2102\\u2105\\u210A-\\u2113\\u2115-\\u211E\\u2122\\u2124\\u2127-\\u2129\\u212C\\u212D\\u212F-\\u2131\\u2133-\\u2138\\u2145-\\u2148\\u2153-\\u215E\\u2190-\\u219B\\u219D-\\u21A7\\u21A9-\\u21AE\\u21B0-\\u21B3\\u21B5-\\u21B7\\u21BA-\\u21DB\\u21DD\\u21E4\\u21E5\\u21F5\\u21FD-\\u2205\\u2207-\\u2209\\u220B\\u220C\\u220F-\\u2214\\u2216-\\u2218\\u221A\\u221D-\\u2238\\u223A-\\u2257\\u2259\\u225A\\u225C\\u225F-\\u2262\\u2264-\\u228B\\u228D-\\u229B\\u229D-\\u22A5\\u22A7-\\u22B0\\u22B2-\\u22BB\\u22BD-\\u22DB\\u22DE-\\u22E3\\u22E6-\\u22F7\\u22F9-\\u22FE\\u2305\\u2306\\u2308-\\u2310\\u2312\\u2313\\u2315\\u2316\\u231C-\\u231F\\u2322\\u2323\\u232D\\u232E\\u2336\\u233D\\u233F\\u237C\\u23B0\\u23B1\\u23B4-\\u23B6\\u23DC-\\u23DF\\u23E2\\u23E7\\u2423\\u24C8\\u2500\\u2502\\u250C\\u2510\\u2514\\u2518\\u251C\\u2524\\u252C\\u2534\\u253C\\u2550-\\u256C\\u2580\\u2584\\u2588\\u2591-\\u2593\\u25A1\\u25AA\\u25AB\\u25AD\\u25AE\\u25B1\\u25B3-\\u25B5\\u25B8\\u25B9\\u25BD-\\u25BF\\u25C2\\u25C3\\u25CA\\u25CB\\u25EC\\u25EF\\u25F8-\\u25FC\\u2605\\u2606\\u260E\\u2640\\u2642\\u2660\\u2663\\u2665\\u2666\\u266A\\u266D-\\u266F\\u2713\\u2717\\u2720\\u2736\\u2758\\u2772\\u2773\\u27C8\\u27C9\\u27E6-\\u27ED\\u27F5-\\u27FA\\u27FC\\u27FF\\u2902-\\u2905\\u290C-\\u2913\\u2916\\u2919-\\u2920\\u2923-\\u292A\\u2933\\u2935-\\u2939\\u293C\\u293D\\u2945\\u2948-\\u294B\\u294E-\\u2976\\u2978\\u2979\\u297B-\\u297F\\u2985\\u2986\\u298B-\\u2996\\u299A\\u299C\\u299D\\u29A4-\\u29B7\\u29B9\\u29BB\\u29BC\\u29BE-\\u29C5\\u29C9\\u29CD-\\u29D0\\u29DC-\\u29DE\\u29E3-\\u29E5\\u29EB\\u29F4\\u29F6\\u2A00-\\u2A02\\u2A04\\u2A06\\u2A0C\\u2A0D\\u2A10-\\u2A17\\u2A22-\\u2A27\\u2A29\\u2A2A\\u2A2D-\\u2A31\\u2A33-\\u2A3C\\u2A3F\\u2A40\\u2A42-\\u2A4D\\u2A50\\u2A53-\\u2A58\\u2A5A-\\u2A5D\\u2A5F\\u2A66\\u2A6A\\u2A6D-\\u2A75\\u2A77-\\u2A9A\\u2A9D-\\u2AA2\\u2AA4-\\u2AB0\\u2AB3-\\u2AC8\\u2ACB\\u2ACC\\u2ACF-\\u2ADB\\u2AE4\\u2AE6-\\u2AE9\\u2AEB-\\u2AF3\\u2AFD\\uFB00-\\uFB04]|\\uD835[\\uDC9C\\uDC9E\\uDC9F\\uDCA2\\uDCA5\\uDCA6\\uDCA9-\\uDCAC\\uDCAE-\\uDCB9\\uDCBB\\uDCBD-\\uDCC3\\uDCC5-\\uDCCF\\uDD04\\uDD05\\uDD07-\\uDD0A\\uDD0D-\\uDD14\\uDD16-\\uDD1C\\uDD1E-\\uDD39\\uDD3B-\\uDD3E\\uDD40-\\uDD44\\uDD46\\uDD4A-\\uDD50\\uDD52-\\uDD6B]");
define("file:///home/sdorries/repos/github/he/src/data/regex-invalid-raw-code-points", [], "[\\0-\\x08\\x0B\\x0E-\\x1F\\x7F-\\x9F\\uFDD0-\\uFDEF\\uFFFE\\uFFFF]|[\\uD83F\\uD87F\\uD8BF\\uD8FF\\uD93F\\uD97F\\uD9BF\\uD9FF\\uDA3F\\uDA7F\\uDABF\\uDAFF\\uDB3F\\uDB7F\\uDBBF\\uDBFF][\\uDFFE\\uDFFF]|[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])|(?:[^\\uD800-\\uDBFF]|^)[\\uDC00-\\uDFFF]");
define("file:///home/sdorries/repos/github/he/src/data/regex-legacy-reference", [], "&(Aacute|Agrave|Atilde|Ccedil|Eacute|Egrave|Iacute|Igrave|Ntilde|Oacute|Ograve|Oslash|Otilde|Uacute|Ugrave|Yacute|aacute|agrave|atilde|brvbar|ccedil|curren|divide|eacute|egrave|frac12|frac14|frac34|iacute|igrave|iquest|middot|ntilde|oacute|ograve|oslash|otilde|plusmn|uacute|ugrave|yacute|AElig|Acirc|Aring|Ecirc|Icirc|Ocirc|THORN|Ucirc|acirc|acute|aelig|aring|cedil|ecirc|icirc|iexcl|laquo|micro|ocirc|pound|raquo|szlig|thorn|times|ucirc|Auml|COPY|Euml|Iuml|Ouml|QUOT|Uuml|auml|cent|copy|euml|iuml|macr|nbsp|ordf|ordm|ouml|para|quot|sect|sup1|sup2|sup3|uuml|yuml|AMP|ETH|REG|amp|deg|eth|not|reg|shy|uml|yen|GT|LT|gt|lt)(?!;)([=a-zA-Z0-9]?)");
define("file:///home/sdorries/repos/github/he/src/data/regex-named-reference", [], "&(CounterClockwiseContourIntegral|ClockwiseContourIntegral|DoubleLongLeftRightArrow|NotNestedGreaterGreater|DiacriticalDoubleAcute|NotSquareSupersetEqual|CloseCurlyDoubleQuote|DoubleContourIntegral|FilledVerySmallSquare|NegativeVeryThinSpace|NotPrecedesSlantEqual|NotRightTriangleEqual|NotSucceedsSlantEqual|CapitalDifferentialD|DoubleLeftRightArrow|DoubleLongRightArrow|EmptyVerySmallSquare|NestedGreaterGreater|NotDoubleVerticalBar|NotGreaterSlantEqual|NotLeftTriangleEqual|NotSquareSubsetEqual|OpenCurlyDoubleQuote|ReverseUpEquilibrium|DoubleLongLeftArrow|DownLeftRightVector|LeftArrowRightArrow|leftrightsquigarrow|NegativeMediumSpace|NotGreaterFullEqual|NotRightTriangleBar|RightArrowLeftArrow|SquareSupersetEqual|blacktriangleright|DownRightTeeVector|DownRightVectorBar|LongLeftRightArrow|Longleftrightarrow|longleftrightarrow|NegativeThickSpace|NotLeftTriangleBar|PrecedesSlantEqual|ReverseEquilibrium|RightDoubleBracket|RightDownTeeVector|RightDownVectorBar|RightTriangleEqual|SquareIntersection|SucceedsSlantEqual|blacktriangledown|blacktriangleleft|DoubleUpDownArrow|DoubleVerticalBar|DownLeftTeeVector|DownLeftVectorBar|FilledSmallSquare|GreaterSlantEqual|LeftDoubleBracket|LeftDownTeeVector|LeftDownVectorBar|leftrightharpoons|LeftTriangleEqual|NegativeThinSpace|NotGreaterGreater|NotLessSlantEqual|NotNestedLessLess|NotReverseElement|NotSquareSuperset|NotTildeFullEqual|RightAngleBracket|rightleftharpoons|RightUpDownVector|SquareSubsetEqual|twoheadrightarrow|VerticalSeparator|circlearrowright|DiacriticalAcute|DiacriticalGrave|DiacriticalTilde|DoubleRightArrow|DownArrowUpArrow|downharpoonright|EmptySmallSquare|GreaterEqualLess|GreaterFullEqual|LeftAngleBracket|LeftUpDownVector|LessEqualGreater|NonBreakingSpace|NotPrecedesEqual|NotRightTriangle|NotSucceedsEqual|NotSucceedsTilde|NotSupersetEqual|ntrianglerighteq|rightharpoondown|rightrightarrows|RightTriangleBar|RightUpTeeVector|RightUpVectorBar|twoheadleftarrow|UnderParenthesis|UpArrowDownArrow|vartriangleright|bigtriangledown|circlearrowleft|CloseCurlyQuote|ContourIntegral|curvearrowright|DoubleDownArrow|DoubleLeftArrow|downharpoonleft|DownRightVector|leftharpoondown|leftrightarrows|LeftRightVector|LeftTriangleBar|LeftUpTeeVector|LeftUpVectorBar|LowerRightArrow|nLeftrightarrow|nleftrightarrow|NotGreaterEqual|NotGreaterTilde|NotHumpDownHump|NotLeftTriangle|NotSquareSubset|ntrianglelefteq|OverParenthesis|RightDownVector|rightleftarrows|rightsquigarrow|rightthreetimes|ShortRightArrow|straightepsilon|trianglerighteq|UpperRightArrow|vartriangleleft|curvearrowleft|DiacriticalDot|doublebarwedge|DoubleRightTee|downdownarrows|DownLeftVector|GreaterGreater|hookrightarrow|HorizontalLine|InvisibleComma|InvisibleTimes|LeftDownVector|leftleftarrows|LeftRightArrow|Leftrightarrow|leftrightarrow|leftthreetimes|LessSlantEqual|LongRightArrow|Longrightarrow|longrightarrow|looparrowright|LowerLeftArrow|NestedLessLess|NotGreaterLess|NotLessGreater|NotSubsetEqual|NotVerticalBar|nshortparallel|ntriangleright|OpenCurlyQuote|ReverseElement|rightarrowtail|rightharpoonup|RightTeeVector|RightVectorBar|ShortDownArrow|ShortLeftArrow|SquareSuperset|TildeFullEqual|trianglelefteq|upharpoonright|UpperLeftArrow|ZeroWidthSpace|ApplyFunction|bigtriangleup|blacktriangle|DifferentialD|divideontimes|DoubleLeftTee|DoubleUpArrow|fallingdotseq|hookleftarrow|leftarrowtail|leftharpoonup|LeftTeeVector|LeftVectorBar|LessFullEqual|LongLeftArrow|Longleftarrow|longleftarrow|looparrowleft|measuredangle|NotEqualTilde|NotTildeEqual|NotTildeTilde|ntriangleleft|Poincareplane|PrecedesEqual|PrecedesTilde|RightArrowBar|RightTeeArrow|RightTriangle|RightUpVector|shortparallel|smallsetminus|SucceedsEqual|SucceedsTilde|SupersetEqual|triangleright|UpEquilibrium|upharpoonleft|varsubsetneqq|varsupsetneqq|VerticalTilde|VeryThinSpace|blacklozenge|DownArrowBar|DownTeeArrow|ExponentialE|exponentiale|GreaterEqual|GreaterTilde|HilbertSpace|HumpDownHump|Intersection|LeftArrowBar|LeftTeeArrow|LeftTriangle|LeftUpVector|NotCongruent|NotHumpEqual|NotLessEqual|NotLessTilde|Proportional|RightCeiling|risingdotseq|RoundImplies|ShortUpArrow|SquareSubset|triangledown|triangleleft|UnderBracket|varsubsetneq|varsupsetneq|VerticalLine|backepsilon|blacksquare|circledcirc|circleddash|CircleMinus|CircleTimes|curlyeqprec|curlyeqsucc|diamondsuit|eqslantless|Equilibrium|expectation|GreaterLess|LeftCeiling|LessGreater|MediumSpace|NotLessLess|NotPrecedes|NotSucceeds|NotSuperset|nRightarrow|nrightarrow|OverBracket|preccurlyeq|precnapprox|quaternions|RightVector|Rrightarrow|RuleDelayed|SmallCircle|SquareUnion|straightphi|SubsetEqual|succcurlyeq|succnapprox|thickapprox|UpDownArrow|Updownarrow|updownarrow|VerticalBar|Bernoullis|circledast|CirclePlus|complement|curlywedge|eqslantgtr|EqualTilde|Fouriertrf|gtreqqless|ImaginaryI|Laplacetrf|LeftVector|lessapprox|lesseqqgtr|Lleftarrow|lmoustache|longmapsto|mapstodown|mapstoleft|nLeftarrow|nleftarrow|NotElement|NotGreater|nsubseteqq|nsupseteqq|precapprox|Proportion|RightArrow|Rightarrow|rightarrow|RightFloor|rmoustache|sqsubseteq|sqsupseteq|subsetneqq|succapprox|supsetneqq|ThickSpace|TildeEqual|TildeTilde|UnderBrace|UpArrowBar|UpTeeArrow|upuparrows|varepsilon|varnothing|backprime|backsimeq|Backslash|bigotimes|CenterDot|centerdot|checkmark|CircleDot|complexes|Congruent|Coproduct|dotsquare|DoubleDot|DownArrow|Downarrow|downarrow|DownBreve|gtrapprox|gtreqless|gvertneqq|heartsuit|HumpEqual|LeftArrow|Leftarrow|leftarrow|LeftFloor|lesseqgtr|LessTilde|lvertneqq|Mellintrf|MinusPlus|ngeqslant|nleqslant|NotCupCap|NotExists|NotSubset|nparallel|nshortmid|nsubseteq|nsupseteq|OverBrace|pitchfork|PlusMinus|rationals|spadesuit|subseteqq|subsetneq|supseteqq|supsetneq|Therefore|therefore|ThinSpace|triangleq|TripleDot|UnionPlus|varpropto|andslope|angmsdaa|angmsdab|angmsdac|angmsdad|angmsdae|angmsdaf|angmsdag|angmsdah|angrtvbd|approxeq|awconint|backcong|barwedge|bbrktbrk|bigoplus|bigsqcup|biguplus|bigwedge|boxminus|boxtimes|bsolhsub|capbrcup|circledR|circledS|cirfnint|clubsuit|cupbrcap|curlyvee|cwconint|DDotrahd|doteqdot|DotEqual|dotminus|drbkarow|dzigrarr|elinters|emptyset|eqvparsl|fpartint|geqslant|gesdotol|gnapprox|hksearow|hkswarow|imagline|imagpart|infintie|integers|Integral|intercal|intlarhk|laemptyv|ldrushar|leqslant|lesdotor|LessLess|llcorner|lnapprox|lrcorner|lurdshar|mapstoup|multimap|naturals|ncongdot|NotEqual|notindot|NotTilde|otimesas|parallel|PartialD|plusacir|pointint|Precedes|precneqq|precnsim|profalar|profline|profsurf|raemptyv|realpart|RightTee|rppolint|rtriltri|scpolint|setminus|shortmid|smeparsl|sqsubset|sqsupset|subseteq|Succeeds|succneqq|succnsim|SuchThat|Superset|supseteq|thetasym|thicksim|timesbar|triangle|triminus|trpezium|Uarrocir|ulcorner|UnderBar|urcorner|varkappa|varsigma|vartheta|alefsym|angrtvb|angzarr|asympeq|backsim|Because|because|bemptyv|between|bigcirc|bigodot|bigstar|bnequiv|boxplus|Cayleys|Cconint|ccupssm|Cedilla|cemptyv|cirscir|coloneq|congdot|cudarrl|cudarrr|cularrp|curarrm|dbkarow|ddagger|ddotseq|demptyv|Diamond|diamond|digamma|dotplus|DownTee|dwangle|Element|Epsilon|epsilon|eqcolon|equivDD|gesdoto|gtquest|gtrless|harrcir|Implies|intprod|isindot|larrbfs|larrsim|lbrksld|lbrkslu|ldrdhar|LeftTee|lesdoto|lessdot|lessgtr|lesssim|lotimes|lozenge|ltquest|luruhar|maltese|minusdu|napprox|natural|nearrow|NewLine|nexists|NoBreak|notinva|notinvb|notinvc|NotLess|notniva|notnivb|notnivc|npolint|npreceq|nsqsube|nsqsupe|nsubset|nsucceq|nsupset|nvinfin|nvltrie|nvrtrie|nwarrow|olcross|Omicron|omicron|orderof|orslope|OverBar|pertenk|planckh|pluscir|plussim|plustwo|precsim|Product|quatint|questeq|rarrbfs|rarrsim|rbrksld|rbrkslu|rdldhar|realine|rotimes|ruluhar|searrow|simplus|simrarr|subedot|submult|subplus|subrarr|succsim|supdsub|supedot|suphsol|suphsub|suplarr|supmult|supplus|swarrow|topfork|triplus|tritime|UpArrow|Uparrow|uparrow|Upsilon|upsilon|uwangle|vzigzag|zigrarr|Aacute|aacute|Abreve|abreve|Agrave|agrave|andand|angmsd|angsph|apacir|approx|Assign|Atilde|atilde|barvee|Barwed|barwed|becaus|bernou|bigcap|bigcup|bigvee|bkarow|bottom|bowtie|boxbox|bprime|brvbar|bullet|Bumpeq|bumpeq|Cacute|cacute|capand|capcap|capcup|capdot|Ccaron|ccaron|Ccedil|ccedil|circeq|cirmid|Colone|colone|commat|compfn|Conint|conint|coprod|copysr|cularr|CupCap|cupcap|cupcup|cupdot|curarr|curren|cylcty|Dagger|dagger|daleth|Dcaron|dcaron|dfisht|divide|divonx|dlcorn|dlcrop|dollar|DotDot|drcorn|drcrop|Dstrok|dstrok|Eacute|eacute|easter|Ecaron|ecaron|ecolon|Egrave|egrave|egsdot|elsdot|emptyv|emsp13|emsp14|eparsl|eqcirc|equals|equest|Exists|female|ffilig|ffllig|ForAll|forall|frac12|frac13|frac14|frac15|frac16|frac18|frac23|frac25|frac34|frac35|frac38|frac45|frac56|frac58|frac78|gacute|Gammad|gammad|Gbreve|gbreve|Gcedil|gesdot|gesles|gtlPar|gtrarr|gtrdot|gtrsim|hairsp|hamilt|HARDcy|hardcy|hearts|hellip|hercon|homtht|horbar|hslash|Hstrok|hstrok|hybull|hyphen|Iacute|iacute|Igrave|igrave|iiiint|iinfin|incare|inodot|intcal|iquest|isinsv|Itilde|itilde|Jsercy|jsercy|kappav|Kcedil|kcedil|kgreen|Lacute|lacute|lagran|Lambda|lambda|langle|larrfs|larrhk|larrlp|larrpl|larrtl|lAtail|latail|lbrace|lbrack|Lcaron|lcaron|Lcedil|lcedil|ldquor|lesdot|lesges|lfisht|lfloor|lharul|llhard|Lmidot|lmidot|lmoust|loplus|lowast|lowbar|lparlt|lrhard|lsaquo|lsquor|Lstrok|lstrok|lthree|ltimes|ltlarr|ltrPar|mapsto|marker|mcomma|midast|midcir|middot|minusb|minusd|mnplus|models|mstpos|Nacute|nacute|nbumpe|Ncaron|ncaron|Ncedil|ncedil|nearhk|nequiv|nesear|nexist|nltrie|notinE|nparsl|nprcue|nrarrc|nrarrw|nrtrie|nsccue|nsimeq|Ntilde|ntilde|numero|nVDash|nVdash|nvDash|nvdash|nvHarr|nvlArr|nvrArr|nwarhk|nwnear|Oacute|oacute|Odblac|odblac|odsold|Ograve|ograve|ominus|origof|Oslash|oslash|Otilde|otilde|Otimes|otimes|parsim|percnt|period|permil|phmmat|planck|plankv|plusdo|plusdu|plusmn|preceq|primes|prnsim|propto|prurel|puncsp|qprime|Racute|racute|rangle|rarrap|rarrfs|rarrhk|rarrlp|rarrpl|Rarrtl|rarrtl|rAtail|ratail|rbrace|rbrack|Rcaron|rcaron|Rcedil|rcedil|rdquor|rfisht|rfloor|rharul|rmoust|roplus|rpargt|rsaquo|rsquor|rthree|rtimes|Sacute|sacute|Scaron|scaron|Scedil|scedil|scnsim|searhk|seswar|sfrown|SHCHcy|shchcy|sigmaf|sigmav|simdot|smashp|SOFTcy|softcy|solbar|spades|sqcaps|sqcups|sqsube|sqsupe|Square|square|squarf|ssetmn|ssmile|sstarf|subdot|Subset|subset|subsim|subsub|subsup|succeq|supdot|Supset|supset|supsim|supsub|supsup|swarhk|swnwar|target|Tcaron|tcaron|Tcedil|tcedil|telrec|there4|thetav|thinsp|thksim|timesb|timesd|topbot|topcir|tprime|tridot|Tstrok|tstrok|Uacute|uacute|Ubreve|ubreve|Udblac|udblac|ufisht|Ugrave|ugrave|ulcorn|ulcrop|urcorn|urcrop|Utilde|utilde|vangrt|varphi|varrho|Vdashl|veebar|vellip|Verbar|verbar|vsubnE|vsubne|vsupnE|vsupne|Vvdash|wedbar|wedgeq|weierp|wreath|xoplus|xotime|xsqcup|xuplus|xwedge|Yacute|yacute|Zacute|zacute|Zcaron|zcaron|zeetrf|Acirc|acirc|acute|AElig|aelig|aleph|Alpha|alpha|Amacr|amacr|amalg|angle|angrt|angst|Aogon|aogon|Aring|aring|asymp|awint|bcong|bdquo|bepsi|blank|blk12|blk14|blk34|block|boxDL|boxDl|boxdL|boxdl|boxDR|boxDr|boxdR|boxdr|boxHD|boxHd|boxhD|boxhd|boxHU|boxHu|boxhU|boxhu|boxUL|boxUl|boxuL|boxul|boxUR|boxUr|boxuR|boxur|boxVH|boxVh|boxvH|boxvh|boxVL|boxVl|boxvL|boxvl|boxVR|boxVr|boxvR|boxvr|Breve|breve|bsemi|bsime|bsolb|bumpE|bumpe|caret|caron|ccaps|Ccirc|ccirc|ccups|cedil|check|clubs|Colon|colon|comma|crarr|Cross|cross|csube|csupe|ctdot|cuepr|cuesc|cupor|cuvee|cuwed|cwint|Dashv|dashv|dblac|ddarr|Delta|delta|dharl|dharr|diams|disin|doteq|dtdot|dtrif|duarr|duhar|Ecirc|ecirc|eDDot|efDot|Emacr|emacr|empty|Eogon|eogon|eplus|epsiv|eqsim|Equal|equiv|erarr|erDot|esdot|exist|fflig|filig|fjlig|fllig|fltns|forkv|frasl|frown|Gamma|gamma|Gcirc|gcirc|gescc|gimel|gneqq|gnsim|grave|gsime|gsiml|gtcir|gtdot|Hacek|harrw|Hcirc|hcirc|hoarr|Icirc|icirc|iexcl|iiint|iiota|IJlig|ijlig|Imacr|imacr|image|imath|imped|infin|Iogon|iogon|iprod|isinE|isins|isinv|Iukcy|iukcy|Jcirc|jcirc|jmath|Jukcy|jukcy|Kappa|kappa|lAarr|langd|laquo|larrb|lates|lBarr|lbarr|lbbrk|lbrke|lceil|ldquo|lescc|lhard|lharu|lhblk|llarr|lltri|lneqq|lnsim|loang|loarr|lobrk|lopar|lrarr|lrhar|lrtri|lsime|lsimg|lsquo|ltcir|ltdot|ltrie|ltrif|mdash|mDDot|micro|minus|mumap|nabla|napid|napos|natur|nbump|ncong|ndash|neArr|nearr|nedot|nesim|ngeqq|ngsim|nhArr|nharr|nhpar|nlArr|nlarr|nleqq|nless|nlsim|nltri|notin|notni|npart|nprec|nrArr|nrarr|nrtri|nsime|nsmid|nspar|nsubE|nsube|nsucc|nsupE|nsupe|numsp|nvsim|nwArr|nwarr|Ocirc|ocirc|odash|OElig|oelig|ofcir|ohbar|olarr|olcir|oline|Omacr|omacr|Omega|omega|operp|oplus|orarr|order|ovbar|parsl|phone|plusb|pluse|pound|prcue|Prime|prime|prnap|prsim|quest|rAarr|radic|rangd|range|raquo|rarrb|rarrc|rarrw|ratio|RBarr|rBarr|rbarr|rbbrk|rbrke|rceil|rdquo|reals|rhard|rharu|rlarr|rlhar|rnmid|roang|roarr|robrk|ropar|rrarr|rsquo|rtrie|rtrif|sbquo|sccue|Scirc|scirc|scnap|scsim|sdotb|sdote|seArr|searr|setmn|sharp|Sigma|sigma|simeq|simgE|simlE|simne|slarr|smile|smtes|sqcap|sqcup|sqsub|sqsup|srarr|starf|strns|subnE|subne|supnE|supne|swArr|swarr|szlig|Theta|theta|thkap|THORN|thorn|Tilde|tilde|times|TRADE|trade|trisb|TSHcy|tshcy|twixt|Ubrcy|ubrcy|Ucirc|ucirc|udarr|udhar|uharl|uharr|uhblk|ultri|Umacr|umacr|Union|Uogon|uogon|uplus|upsih|UpTee|Uring|uring|urtri|utdot|utrif|uuarr|varpi|vBarv|VDash|Vdash|vDash|vdash|veeeq|vltri|vnsub|vnsup|vprop|vrtri|Wcirc|wcirc|Wedge|wedge|xcirc|xdtri|xhArr|xharr|xlArr|xlarr|xodot|xrArr|xrarr|xutri|Ycirc|ycirc|andd|andv|ange|Aopf|aopf|apid|apos|Ascr|ascr|Auml|auml|Barv|bbrk|Beta|beta|beth|bNot|bnot|Bopf|bopf|boxH|boxh|boxV|boxv|Bscr|bscr|bsim|bsol|bull|bump|caps|Cdot|cdot|cent|CHcy|chcy|circ|cirE|cire|comp|cong|Copf|copf|COPY|copy|Cscr|cscr|csub|csup|cups|Darr|dArr|darr|dash|dHar|diam|DJcy|djcy|Dopf|dopf|Dscr|dscr|DScy|dscy|dsol|dtri|DZcy|dzcy|ecir|Edot|eDot|edot|emsp|ensp|Eopf|eopf|epar|epsi|Escr|escr|Esim|esim|Euml|euml|euro|excl|flat|fnof|Fopf|fopf|fork|Fscr|fscr|Gdot|gdot|geqq|gesl|GJcy|gjcy|gnap|gneq|Gopf|gopf|Gscr|gscr|gsim|gtcc|gvnE|half|hArr|harr|hbar|Hopf|hopf|Hscr|hscr|Idot|IEcy|iecy|imof|IOcy|iocy|Iopf|iopf|Iota|iota|Iscr|iscr|isin|Iuml|iuml|Jopf|jopf|Jscr|jscr|KHcy|khcy|KJcy|kjcy|Kopf|kopf|Kscr|kscr|Lang|lang|Larr|lArr|larr|late|lcub|ldca|ldsh|leqq|lesg|lHar|LJcy|ljcy|lnap|lneq|Lopf|lopf|lozf|lpar|Lscr|lscr|lsim|lsqb|ltcc|ltri|lvnE|macr|male|malt|mlcp|mldr|Mopf|mopf|Mscr|mscr|nang|napE|nbsp|ncap|ncup|ngeq|nges|ngtr|nGtv|nisd|NJcy|njcy|nldr|nleq|nles|nLtv|nmid|Nopf|nopf|npar|npre|nsce|Nscr|nscr|nsim|nsub|nsup|ntgl|ntlg|nvap|nvge|nvgt|nvle|nvlt|oast|ocir|odiv|odot|ogon|oint|omid|Oopf|oopf|opar|ordf|ordm|oror|Oscr|oscr|osol|Ouml|ouml|para|part|perp|phiv|plus|Popf|popf|prap|prec|prnE|prod|prop|Pscr|pscr|qint|Qopf|qopf|Qscr|qscr|QUOT|quot|race|Rang|rang|Rarr|rArr|rarr|rcub|rdca|rdsh|real|rect|rHar|rhov|ring|Ropf|ropf|rpar|Rscr|rscr|rsqb|rtri|scap|scnE|sdot|sect|semi|sext|SHcy|shcy|sime|simg|siml|smid|smte|solb|Sopf|sopf|spar|Sqrt|squf|Sscr|sscr|Star|star|subE|sube|succ|sung|sup1|sup2|sup3|supE|supe|tbrk|tdot|tint|toea|Topf|topf|tosa|trie|Tscr|tscr|TScy|tscy|Uarr|uArr|uarr|uHar|Uopf|uopf|Upsi|upsi|Uscr|uscr|utri|Uuml|uuml|vArr|varr|Vbar|vBar|Vert|vert|Vopf|vopf|Vscr|vscr|Wopf|wopf|Wscr|wscr|xcap|xcup|xmap|xnis|Xopf|xopf|Xscr|xscr|xvee|YAcy|yacy|YIcy|yicy|Yopf|yopf|Yscr|yscr|YUcy|yucy|Yuml|yuml|Zdot|zdot|Zeta|zeta|ZHcy|zhcy|Zopf|zopf|Zscr|zscr|zwnj|acd|acE|Acy|acy|Afr|afr|AMP|amp|And|and|ang|apE|ape|ast|Bcy|bcy|Bfr|bfr|bne|bot|Cap|cap|Cfr|cfr|Chi|chi|cir|Cup|cup|Dcy|dcy|deg|Del|Dfr|dfr|die|div|Dot|dot|Ecy|ecy|Efr|efr|egs|ell|els|ENG|eng|Eta|eta|ETH|eth|Fcy|fcy|Ffr|ffr|gap|Gcy|gcy|gEl|gel|geq|ges|Gfr|gfr|ggg|gla|glE|glj|gnE|gne|Hat|Hfr|hfr|Icy|icy|iff|Ifr|ifr|Int|int|Jcy|jcy|Jfr|jfr|Kcy|kcy|Kfr|kfr|lap|lat|Lcy|lcy|lEg|leg|leq|les|Lfr|lfr|lgE|lnE|lne|loz|lrm|Lsh|lsh|Map|map|Mcy|mcy|Mfr|mfr|mho|mid|nap|Ncy|ncy|Nfr|nfr|ngE|nge|nGg|nGt|ngt|nis|niv|nlE|nle|nLl|nLt|nlt|Not|not|npr|nsc|num|Ocy|ocy|Ofr|ofr|ogt|ohm|olt|ord|orv|par|Pcy|pcy|Pfr|pfr|Phi|phi|piv|prE|pre|Psi|psi|Qfr|qfr|Rcy|rcy|REG|reg|Rfr|rfr|Rho|rho|rlm|Rsh|rsh|scE|sce|Scy|scy|Sfr|sfr|shy|sim|smt|sol|squ|Sub|sub|Sum|sum|Sup|sup|Tab|Tau|tau|Tcy|tcy|Tfr|tfr|top|Ucy|ucy|Ufr|ufr|uml|Vcy|vcy|Vee|vee|Vfr|vfr|Wfr|wfr|Xfr|xfr|Ycy|ycy|yen|Yfr|yfr|Zcy|zcy|Zfr|zfr|zwj|ac|af|ap|DD|dd|ee|eg|el|gE|ge|Gg|gg|gl|GT|Gt|gt|ic|ii|Im|in|it|lE|le|lg|Ll|ll|LT|Lt|lt|mp|Mu|mu|ne|ni|Nu|nu|Or|or|oS|Pi|pi|pm|Pr|pr|Re|rx|Sc|sc|wp|wr|Xi|xi);");
define("file:///home/sdorries/repos/github/he/src/data/invalid-code-points-string", [], "\"\\0\\x01\\x02\\x03\\x04\\x05\\x06\\x07\\b\\x0B\\x0E\\x0F\\x10\\x11\\x12\\x13\\x14\\x15\\x16\\x17\\x18\\x19\\x1A\\x1B\\x1C\\x1D\\x1E\\x1F\\x7F\\x80\\x81\\x82\\x83\\x84\\x85\\x86\\x87\\x88\\x89\\x8A\\x8B\\x8C\\x8D\\x8E\\x8F\\x90\\x91\\x92\\x93\\x94\\x95\\x96\\x97\\x98\\x99\\x9A\\x9B\\x9C\\x9D\\x9E\\x9F\\uFDD0\\uFDD1\\uFDD2\\uFDD3\\uFDD4\\uFDD5\\uFDD6\\uFDD7\\uFDD8\\uFDD9\\uFDDA\\uFDDB\\uFDDC\\uFDDD\\uFDDE\\uFDDF\\uFDE0\\uFDE1\\uFDE2\\uFDE3\\uFDE4\\uFDE5\\uFDE6\\uFDE7\\uFDE8\\uFDE9\\uFDEA\\uFDEB\\uFDEC\\uFDED\\uFDEE\\uFDEF\\uFFFE\\uFFFF\\uD83F\\uDFFE\\uD83F\\uDFFF\\uD87F\\uDFFE\\uD87F\\uDFFF\\uD8BF\\uDFFE\\uD8BF\\uDFFF\\uD8FF\\uDFFE\\uD8FF\\uDFFF\\uD93F\\uDFFE\\uD93F\\uDFFF\\uD97F\\uDFFE\\uD97F\\uDFFF\\uD9BF\\uDFFE\\uD9BF\\uDFFF\\uD9FF\\uDFFE\\uD9FF\\uDFFF\\uDA3F\\uDFFE\\uDA3F\\uDFFF\\uDA7F\\uDFFE\\uDA7F\\uDFFF\\uDABF\\uDFFE\\uDABF\\uDFFF\\uDAFF\\uDFFE\\uDAFF\\uDFFF\\uDB3F\\uDFFE\\uDB3F\\uDFFF\\uDB7F\\uDFFE\\uDB7F\\uDFFF\\uDBBF\\uDFFE\\uDBBF\\uDFFF\\uDBFF\\uDFFE\\uDBFF\\uDFFF\"");
define("file:///home/sdorries/repos/github/he/src/data/decode-map", [], {
    "Aacute": "\u00C1",
    "aacute": "\u00E1",
    "Abreve": "\u0102",
    "abreve": "\u0103",
    "ac": "\u223E",
    "acd": "\u223F",
    "acE": "\u223E\u0333",
    "Acirc": "\u00C2",
    "acirc": "\u00E2",
    "acute": "\u00B4",
    "Acy": "\u0410",
    "acy": "\u0430",
    "AElig": "\u00C6",
    "aelig": "\u00E6",
    "af": "\u2061",
    "Afr": "\uD835\uDD04",
    "afr": "\uD835\uDD1E",
    "Agrave": "\u00C0",
    "agrave": "\u00E0",
    "alefsym": "\u2135",
    "aleph": "\u2135",
    "Alpha": "\u0391",
    "alpha": "\u03B1",
    "Amacr": "\u0100",
    "amacr": "\u0101",
    "amalg": "\u2A3F",
    "AMP": "&",
    "amp": "&",
    "And": "\u2A53",
    "and": "\u2227",
    "andand": "\u2A55",
    "andd": "\u2A5C",
    "andslope": "\u2A58",
    "andv": "\u2A5A",
    "ang": "\u2220",
    "ange": "\u29A4",
    "angle": "\u2220",
    "angmsd": "\u2221",
    "angmsdaa": "\u29A8",
    "angmsdab": "\u29A9",
    "angmsdac": "\u29AA",
    "angmsdad": "\u29AB",
    "angmsdae": "\u29AC",
    "angmsdaf": "\u29AD",
    "angmsdag": "\u29AE",
    "angmsdah": "\u29AF",
    "angrt": "\u221F",
    "angrtvb": "\u22BE",
    "angrtvbd": "\u299D",
    "angsph": "\u2222",
    "angst": "\u00C5",
    "angzarr": "\u237C",
    "Aogon": "\u0104",
    "aogon": "\u0105",
    "Aopf": "\uD835\uDD38",
    "aopf": "\uD835\uDD52",
    "ap": "\u2248",
    "apacir": "\u2A6F",
    "apE": "\u2A70",
    "ape": "\u224A",
    "apid": "\u224B",
    "apos": "'",
    "ApplyFunction": "\u2061",
    "approx": "\u2248",
    "approxeq": "\u224A",
    "Aring": "\u00C5",
    "aring": "\u00E5",
    "Ascr": "\uD835\uDC9C",
    "ascr": "\uD835\uDCB6",
    "Assign": "\u2254",
    "ast": "*",
    "asymp": "\u2248",
    "asympeq": "\u224D",
    "Atilde": "\u00C3",
    "atilde": "\u00E3",
    "Auml": "\u00C4",
    "auml": "\u00E4",
    "awconint": "\u2233",
    "awint": "\u2A11",
    "backcong": "\u224C",
    "backepsilon": "\u03F6",
    "backprime": "\u2035",
    "backsim": "\u223D",
    "backsimeq": "\u22CD",
    "Backslash": "\u2216",
    "Barv": "\u2AE7",
    "barvee": "\u22BD",
    "Barwed": "\u2306",
    "barwed": "\u2305",
    "barwedge": "\u2305",
    "bbrk": "\u23B5",
    "bbrktbrk": "\u23B6",
    "bcong": "\u224C",
    "Bcy": "\u0411",
    "bcy": "\u0431",
    "bdquo": "\u201E",
    "becaus": "\u2235",
    "Because": "\u2235",
    "because": "\u2235",
    "bemptyv": "\u29B0",
    "bepsi": "\u03F6",
    "bernou": "\u212C",
    "Bernoullis": "\u212C",
    "Beta": "\u0392",
    "beta": "\u03B2",
    "beth": "\u2136",
    "between": "\u226C",
    "Bfr": "\uD835\uDD05",
    "bfr": "\uD835\uDD1F",
    "bigcap": "\u22C2",
    "bigcirc": "\u25EF",
    "bigcup": "\u22C3",
    "bigodot": "\u2A00",
    "bigoplus": "\u2A01",
    "bigotimes": "\u2A02",
    "bigsqcup": "\u2A06",
    "bigstar": "\u2605",
    "bigtriangledown": "\u25BD",
    "bigtriangleup": "\u25B3",
    "biguplus": "\u2A04",
    "bigvee": "\u22C1",
    "bigwedge": "\u22C0",
    "bkarow": "\u290D",
    "blacklozenge": "\u29EB",
    "blacksquare": "\u25AA",
    "blacktriangle": "\u25B4",
    "blacktriangledown": "\u25BE",
    "blacktriangleleft": "\u25C2",
    "blacktriangleright": "\u25B8",
    "blank": "\u2423",
    "blk12": "\u2592",
    "blk14": "\u2591",
    "blk34": "\u2593",
    "block": "\u2588",
    "bne": "=\u20E5",
    "bnequiv": "\u2261\u20E5",
    "bNot": "\u2AED",
    "bnot": "\u2310",
    "Bopf": "\uD835\uDD39",
    "bopf": "\uD835\uDD53",
    "bot": "\u22A5",
    "bottom": "\u22A5",
    "bowtie": "\u22C8",
    "boxbox": "\u29C9",
    "boxDL": "\u2557",
    "boxDl": "\u2556",
    "boxdL": "\u2555",
    "boxdl": "\u2510",
    "boxDR": "\u2554",
    "boxDr": "\u2553",
    "boxdR": "\u2552",
    "boxdr": "\u250C",
    "boxH": "\u2550",
    "boxh": "\u2500",
    "boxHD": "\u2566",
    "boxHd": "\u2564",
    "boxhD": "\u2565",
    "boxhd": "\u252C",
    "boxHU": "\u2569",
    "boxHu": "\u2567",
    "boxhU": "\u2568",
    "boxhu": "\u2534",
    "boxminus": "\u229F",
    "boxplus": "\u229E",
    "boxtimes": "\u22A0",
    "boxUL": "\u255D",
    "boxUl": "\u255C",
    "boxuL": "\u255B",
    "boxul": "\u2518",
    "boxUR": "\u255A",
    "boxUr": "\u2559",
    "boxuR": "\u2558",
    "boxur": "\u2514",
    "boxV": "\u2551",
    "boxv": "\u2502",
    "boxVH": "\u256C",
    "boxVh": "\u256B",
    "boxvH": "\u256A",
    "boxvh": "\u253C",
    "boxVL": "\u2563",
    "boxVl": "\u2562",
    "boxvL": "\u2561",
    "boxvl": "\u2524",
    "boxVR": "\u2560",
    "boxVr": "\u255F",
    "boxvR": "\u255E",
    "boxvr": "\u251C",
    "bprime": "\u2035",
    "Breve": "\u02D8",
    "breve": "\u02D8",
    "brvbar": "\u00A6",
    "Bscr": "\u212C",
    "bscr": "\uD835\uDCB7",
    "bsemi": "\u204F",
    "bsim": "\u223D",
    "bsime": "\u22CD",
    "bsol": "\\",
    "bsolb": "\u29C5",
    "bsolhsub": "\u27C8",
    "bull": "\u2022",
    "bullet": "\u2022",
    "bump": "\u224E",
    "bumpE": "\u2AAE",
    "bumpe": "\u224F",
    "Bumpeq": "\u224E",
    "bumpeq": "\u224F",
    "Cacute": "\u0106",
    "cacute": "\u0107",
    "Cap": "\u22D2",
    "cap": "\u2229",
    "capand": "\u2A44",
    "capbrcup": "\u2A49",
    "capcap": "\u2A4B",
    "capcup": "\u2A47",
    "capdot": "\u2A40",
    "CapitalDifferentialD": "\u2145",
    "caps": "\u2229\uFE00",
    "caret": "\u2041",
    "caron": "\u02C7",
    "Cayleys": "\u212D",
    "ccaps": "\u2A4D",
    "Ccaron": "\u010C",
    "ccaron": "\u010D",
    "Ccedil": "\u00C7",
    "ccedil": "\u00E7",
    "Ccirc": "\u0108",
    "ccirc": "\u0109",
    "Cconint": "\u2230",
    "ccups": "\u2A4C",
    "ccupssm": "\u2A50",
    "Cdot": "\u010A",
    "cdot": "\u010B",
    "cedil": "\u00B8",
    "Cedilla": "\u00B8",
    "cemptyv": "\u29B2",
    "cent": "\u00A2",
    "CenterDot": "\u00B7",
    "centerdot": "\u00B7",
    "Cfr": "\u212D",
    "cfr": "\uD835\uDD20",
    "CHcy": "\u0427",
    "chcy": "\u0447",
    "check": "\u2713",
    "checkmark": "\u2713",
    "Chi": "\u03A7",
    "chi": "\u03C7",
    "cir": "\u25CB",
    "circ": "\u02C6",
    "circeq": "\u2257",
    "circlearrowleft": "\u21BA",
    "circlearrowright": "\u21BB",
    "circledast": "\u229B",
    "circledcirc": "\u229A",
    "circleddash": "\u229D",
    "CircleDot": "\u2299",
    "circledR": "\u00AE",
    "circledS": "\u24C8",
    "CircleMinus": "\u2296",
    "CirclePlus": "\u2295",
    "CircleTimes": "\u2297",
    "cirE": "\u29C3",
    "cire": "\u2257",
    "cirfnint": "\u2A10",
    "cirmid": "\u2AEF",
    "cirscir": "\u29C2",
    "ClockwiseContourIntegral": "\u2232",
    "CloseCurlyDoubleQuote": "\u201D",
    "CloseCurlyQuote": "\u2019",
    "clubs": "\u2663",
    "clubsuit": "\u2663",
    "Colon": "\u2237",
    "colon": ":",
    "Colone": "\u2A74",
    "colone": "\u2254",
    "coloneq": "\u2254",
    "comma": ",",
    "commat": "@",
    "comp": "\u2201",
    "compfn": "\u2218",
    "complement": "\u2201",
    "complexes": "\u2102",
    "cong": "\u2245",
    "congdot": "\u2A6D",
    "Congruent": "\u2261",
    "Conint": "\u222F",
    "conint": "\u222E",
    "ContourIntegral": "\u222E",
    "Copf": "\u2102",
    "copf": "\uD835\uDD54",
    "coprod": "\u2210",
    "Coproduct": "\u2210",
    "COPY": "\u00A9",
    "copy": "\u00A9",
    "copysr": "\u2117",
    "CounterClockwiseContourIntegral": "\u2233",
    "crarr": "\u21B5",
    "Cross": "\u2A2F",
    "cross": "\u2717",
    "Cscr": "\uD835\uDC9E",
    "cscr": "\uD835\uDCB8",
    "csub": "\u2ACF",
    "csube": "\u2AD1",
    "csup": "\u2AD0",
    "csupe": "\u2AD2",
    "ctdot": "\u22EF",
    "cudarrl": "\u2938",
    "cudarrr": "\u2935",
    "cuepr": "\u22DE",
    "cuesc": "\u22DF",
    "cularr": "\u21B6",
    "cularrp": "\u293D",
    "Cup": "\u22D3",
    "cup": "\u222A",
    "cupbrcap": "\u2A48",
    "CupCap": "\u224D",
    "cupcap": "\u2A46",
    "cupcup": "\u2A4A",
    "cupdot": "\u228D",
    "cupor": "\u2A45",
    "cups": "\u222A\uFE00",
    "curarr": "\u21B7",
    "curarrm": "\u293C",
    "curlyeqprec": "\u22DE",
    "curlyeqsucc": "\u22DF",
    "curlyvee": "\u22CE",
    "curlywedge": "\u22CF",
    "curren": "\u00A4",
    "curvearrowleft": "\u21B6",
    "curvearrowright": "\u21B7",
    "cuvee": "\u22CE",
    "cuwed": "\u22CF",
    "cwconint": "\u2232",
    "cwint": "\u2231",
    "cylcty": "\u232D",
    "Dagger": "\u2021",
    "dagger": "\u2020",
    "daleth": "\u2138",
    "Darr": "\u21A1",
    "dArr": "\u21D3",
    "darr": "\u2193",
    "dash": "\u2010",
    "Dashv": "\u2AE4",
    "dashv": "\u22A3",
    "dbkarow": "\u290F",
    "dblac": "\u02DD",
    "Dcaron": "\u010E",
    "dcaron": "\u010F",
    "Dcy": "\u0414",
    "dcy": "\u0434",
    "DD": "\u2145",
    "dd": "\u2146",
    "ddagger": "\u2021",
    "ddarr": "\u21CA",
    "DDotrahd": "\u2911",
    "ddotseq": "\u2A77",
    "deg": "\u00B0",
    "Del": "\u2207",
    "Delta": "\u0394",
    "delta": "\u03B4",
    "demptyv": "\u29B1",
    "dfisht": "\u297F",
    "Dfr": "\uD835\uDD07",
    "dfr": "\uD835\uDD21",
    "dHar": "\u2965",
    "dharl": "\u21C3",
    "dharr": "\u21C2",
    "DiacriticalAcute": "\u00B4",
    "DiacriticalDot": "\u02D9",
    "DiacriticalDoubleAcute": "\u02DD",
    "DiacriticalGrave": "`",
    "DiacriticalTilde": "\u02DC",
    "diam": "\u22C4",
    "Diamond": "\u22C4",
    "diamond": "\u22C4",
    "diamondsuit": "\u2666",
    "diams": "\u2666",
    "die": "\u00A8",
    "DifferentialD": "\u2146",
    "digamma": "\u03DD",
    "disin": "\u22F2",
    "div": "\u00F7",
    "divide": "\u00F7",
    "divideontimes": "\u22C7",
    "divonx": "\u22C7",
    "DJcy": "\u0402",
    "djcy": "\u0452",
    "dlcorn": "\u231E",
    "dlcrop": "\u230D",
    "dollar": "$",
    "Dopf": "\uD835\uDD3B",
    "dopf": "\uD835\uDD55",
    "Dot": "\u00A8",
    "dot": "\u02D9",
    "DotDot": "\u20DC",
    "doteq": "\u2250",
    "doteqdot": "\u2251",
    "DotEqual": "\u2250",
    "dotminus": "\u2238",
    "dotplus": "\u2214",
    "dotsquare": "\u22A1",
    "doublebarwedge": "\u2306",
    "DoubleContourIntegral": "\u222F",
    "DoubleDot": "\u00A8",
    "DoubleDownArrow": "\u21D3",
    "DoubleLeftArrow": "\u21D0",
    "DoubleLeftRightArrow": "\u21D4",
    "DoubleLeftTee": "\u2AE4",
    "DoubleLongLeftArrow": "\u27F8",
    "DoubleLongLeftRightArrow": "\u27FA",
    "DoubleLongRightArrow": "\u27F9",
    "DoubleRightArrow": "\u21D2",
    "DoubleRightTee": "\u22A8",
    "DoubleUpArrow": "\u21D1",
    "DoubleUpDownArrow": "\u21D5",
    "DoubleVerticalBar": "\u2225",
    "DownArrow": "\u2193",
    "Downarrow": "\u21D3",
    "downarrow": "\u2193",
    "DownArrowBar": "\u2913",
    "DownArrowUpArrow": "\u21F5",
    "DownBreve": "\u0311",
    "downdownarrows": "\u21CA",
    "downharpoonleft": "\u21C3",
    "downharpoonright": "\u21C2",
    "DownLeftRightVector": "\u2950",
    "DownLeftTeeVector": "\u295E",
    "DownLeftVector": "\u21BD",
    "DownLeftVectorBar": "\u2956",
    "DownRightTeeVector": "\u295F",
    "DownRightVector": "\u21C1",
    "DownRightVectorBar": "\u2957",
    "DownTee": "\u22A4",
    "DownTeeArrow": "\u21A7",
    "drbkarow": "\u2910",
    "drcorn": "\u231F",
    "drcrop": "\u230C",
    "Dscr": "\uD835\uDC9F",
    "dscr": "\uD835\uDCB9",
    "DScy": "\u0405",
    "dscy": "\u0455",
    "dsol": "\u29F6",
    "Dstrok": "\u0110",
    "dstrok": "\u0111",
    "dtdot": "\u22F1",
    "dtri": "\u25BF",
    "dtrif": "\u25BE",
    "duarr": "\u21F5",
    "duhar": "\u296F",
    "dwangle": "\u29A6",
    "DZcy": "\u040F",
    "dzcy": "\u045F",
    "dzigrarr": "\u27FF",
    "Eacute": "\u00C9",
    "eacute": "\u00E9",
    "easter": "\u2A6E",
    "Ecaron": "\u011A",
    "ecaron": "\u011B",
    "ecir": "\u2256",
    "Ecirc": "\u00CA",
    "ecirc": "\u00EA",
    "ecolon": "\u2255",
    "Ecy": "\u042D",
    "ecy": "\u044D",
    "eDDot": "\u2A77",
    "Edot": "\u0116",
    "eDot": "\u2251",
    "edot": "\u0117",
    "ee": "\u2147",
    "efDot": "\u2252",
    "Efr": "\uD835\uDD08",
    "efr": "\uD835\uDD22",
    "eg": "\u2A9A",
    "Egrave": "\u00C8",
    "egrave": "\u00E8",
    "egs": "\u2A96",
    "egsdot": "\u2A98",
    "el": "\u2A99",
    "Element": "\u2208",
    "elinters": "\u23E7",
    "ell": "\u2113",
    "els": "\u2A95",
    "elsdot": "\u2A97",
    "Emacr": "\u0112",
    "emacr": "\u0113",
    "empty": "\u2205",
    "emptyset": "\u2205",
    "EmptySmallSquare": "\u25FB",
    "emptyv": "\u2205",
    "EmptyVerySmallSquare": "\u25AB",
    "emsp": "\u2003",
    "emsp13": "\u2004",
    "emsp14": "\u2005",
    "ENG": "\u014A",
    "eng": "\u014B",
    "ensp": "\u2002",
    "Eogon": "\u0118",
    "eogon": "\u0119",
    "Eopf": "\uD835\uDD3C",
    "eopf": "\uD835\uDD56",
    "epar": "\u22D5",
    "eparsl": "\u29E3",
    "eplus": "\u2A71",
    "epsi": "\u03B5",
    "Epsilon": "\u0395",
    "epsilon": "\u03B5",
    "epsiv": "\u03F5",
    "eqcirc": "\u2256",
    "eqcolon": "\u2255",
    "eqsim": "\u2242",
    "eqslantgtr": "\u2A96",
    "eqslantless": "\u2A95",
    "Equal": "\u2A75",
    "equals": "=",
    "EqualTilde": "\u2242",
    "equest": "\u225F",
    "Equilibrium": "\u21CC",
    "equiv": "\u2261",
    "equivDD": "\u2A78",
    "eqvparsl": "\u29E5",
    "erarr": "\u2971",
    "erDot": "\u2253",
    "Escr": "\u2130",
    "escr": "\u212F",
    "esdot": "\u2250",
    "Esim": "\u2A73",
    "esim": "\u2242",
    "Eta": "\u0397",
    "eta": "\u03B7",
    "ETH": "\u00D0",
    "eth": "\u00F0",
    "Euml": "\u00CB",
    "euml": "\u00EB",
    "euro": "\u20AC",
    "excl": "!",
    "exist": "\u2203",
    "Exists": "\u2203",
    "expectation": "\u2130",
    "ExponentialE": "\u2147",
    "exponentiale": "\u2147",
    "fallingdotseq": "\u2252",
    "Fcy": "\u0424",
    "fcy": "\u0444",
    "female": "\u2640",
    "ffilig": "\uFB03",
    "fflig": "\uFB00",
    "ffllig": "\uFB04",
    "Ffr": "\uD835\uDD09",
    "ffr": "\uD835\uDD23",
    "filig": "\uFB01",
    "FilledSmallSquare": "\u25FC",
    "FilledVerySmallSquare": "\u25AA",
    "fjlig": "fj",
    "flat": "\u266D",
    "fllig": "\uFB02",
    "fltns": "\u25B1",
    "fnof": "\u0192",
    "Fopf": "\uD835\uDD3D",
    "fopf": "\uD835\uDD57",
    "ForAll": "\u2200",
    "forall": "\u2200",
    "fork": "\u22D4",
    "forkv": "\u2AD9",
    "Fouriertrf": "\u2131",
    "fpartint": "\u2A0D",
    "frac12": "\u00BD",
    "frac13": "\u2153",
    "frac14": "\u00BC",
    "frac15": "\u2155",
    "frac16": "\u2159",
    "frac18": "\u215B",
    "frac23": "\u2154",
    "frac25": "\u2156",
    "frac34": "\u00BE",
    "frac35": "\u2157",
    "frac38": "\u215C",
    "frac45": "\u2158",
    "frac56": "\u215A",
    "frac58": "\u215D",
    "frac78": "\u215E",
    "frasl": "\u2044",
    "frown": "\u2322",
    "Fscr": "\u2131",
    "fscr": "\uD835\uDCBB",
    "gacute": "\u01F5",
    "Gamma": "\u0393",
    "gamma": "\u03B3",
    "Gammad": "\u03DC",
    "gammad": "\u03DD",
    "gap": "\u2A86",
    "Gbreve": "\u011E",
    "gbreve": "\u011F",
    "Gcedil": "\u0122",
    "Gcirc": "\u011C",
    "gcirc": "\u011D",
    "Gcy": "\u0413",
    "gcy": "\u0433",
    "Gdot": "\u0120",
    "gdot": "\u0121",
    "gE": "\u2267",
    "ge": "\u2265",
    "gEl": "\u2A8C",
    "gel": "\u22DB",
    "geq": "\u2265",
    "geqq": "\u2267",
    "geqslant": "\u2A7E",
    "ges": "\u2A7E",
    "gescc": "\u2AA9",
    "gesdot": "\u2A80",
    "gesdoto": "\u2A82",
    "gesdotol": "\u2A84",
    "gesl": "\u22DB\uFE00",
    "gesles": "\u2A94",
    "Gfr": "\uD835\uDD0A",
    "gfr": "\uD835\uDD24",
    "Gg": "\u22D9",
    "gg": "\u226B",
    "ggg": "\u22D9",
    "gimel": "\u2137",
    "GJcy": "\u0403",
    "gjcy": "\u0453",
    "gl": "\u2277",
    "gla": "\u2AA5",
    "glE": "\u2A92",
    "glj": "\u2AA4",
    "gnap": "\u2A8A",
    "gnapprox": "\u2A8A",
    "gnE": "\u2269",
    "gne": "\u2A88",
    "gneq": "\u2A88",
    "gneqq": "\u2269",
    "gnsim": "\u22E7",
    "Gopf": "\uD835\uDD3E",
    "gopf": "\uD835\uDD58",
    "grave": "`",
    "GreaterEqual": "\u2265",
    "GreaterEqualLess": "\u22DB",
    "GreaterFullEqual": "\u2267",
    "GreaterGreater": "\u2AA2",
    "GreaterLess": "\u2277",
    "GreaterSlantEqual": "\u2A7E",
    "GreaterTilde": "\u2273",
    "Gscr": "\uD835\uDCA2",
    "gscr": "\u210A",
    "gsim": "\u2273",
    "gsime": "\u2A8E",
    "gsiml": "\u2A90",
    "GT": ">",
    "Gt": "\u226B",
    "gt": ">",
    "gtcc": "\u2AA7",
    "gtcir": "\u2A7A",
    "gtdot": "\u22D7",
    "gtlPar": "\u2995",
    "gtquest": "\u2A7C",
    "gtrapprox": "\u2A86",
    "gtrarr": "\u2978",
    "gtrdot": "\u22D7",
    "gtreqless": "\u22DB",
    "gtreqqless": "\u2A8C",
    "gtrless": "\u2277",
    "gtrsim": "\u2273",
    "gvertneqq": "\u2269\uFE00",
    "gvnE": "\u2269\uFE00",
    "Hacek": "\u02C7",
    "hairsp": "\u200A",
    "half": "\u00BD",
    "hamilt": "\u210B",
    "HARDcy": "\u042A",
    "hardcy": "\u044A",
    "hArr": "\u21D4",
    "harr": "\u2194",
    "harrcir": "\u2948",
    "harrw": "\u21AD",
    "Hat": "^",
    "hbar": "\u210F",
    "Hcirc": "\u0124",
    "hcirc": "\u0125",
    "hearts": "\u2665",
    "heartsuit": "\u2665",
    "hellip": "\u2026",
    "hercon": "\u22B9",
    "Hfr": "\u210C",
    "hfr": "\uD835\uDD25",
    "HilbertSpace": "\u210B",
    "hksearow": "\u2925",
    "hkswarow": "\u2926",
    "hoarr": "\u21FF",
    "homtht": "\u223B",
    "hookleftarrow": "\u21A9",
    "hookrightarrow": "\u21AA",
    "Hopf": "\u210D",
    "hopf": "\uD835\uDD59",
    "horbar": "\u2015",
    "HorizontalLine": "\u2500",
    "Hscr": "\u210B",
    "hscr": "\uD835\uDCBD",
    "hslash": "\u210F",
    "Hstrok": "\u0126",
    "hstrok": "\u0127",
    "HumpDownHump": "\u224E",
    "HumpEqual": "\u224F",
    "hybull": "\u2043",
    "hyphen": "\u2010",
    "Iacute": "\u00CD",
    "iacute": "\u00ED",
    "ic": "\u2063",
    "Icirc": "\u00CE",
    "icirc": "\u00EE",
    "Icy": "\u0418",
    "icy": "\u0438",
    "Idot": "\u0130",
    "IEcy": "\u0415",
    "iecy": "\u0435",
    "iexcl": "\u00A1",
    "iff": "\u21D4",
    "Ifr": "\u2111",
    "ifr": "\uD835\uDD26",
    "Igrave": "\u00CC",
    "igrave": "\u00EC",
    "ii": "\u2148",
    "iiiint": "\u2A0C",
    "iiint": "\u222D",
    "iinfin": "\u29DC",
    "iiota": "\u2129",
    "IJlig": "\u0132",
    "ijlig": "\u0133",
    "Im": "\u2111",
    "Imacr": "\u012A",
    "imacr": "\u012B",
    "image": "\u2111",
    "ImaginaryI": "\u2148",
    "imagline": "\u2110",
    "imagpart": "\u2111",
    "imath": "\u0131",
    "imof": "\u22B7",
    "imped": "\u01B5",
    "Implies": "\u21D2",
    "in": "\u2208",
    "incare": "\u2105",
    "infin": "\u221E",
    "infintie": "\u29DD",
    "inodot": "\u0131",
    "Int": "\u222C",
    "int": "\u222B",
    "intcal": "\u22BA",
    "integers": "\u2124",
    "Integral": "\u222B",
    "intercal": "\u22BA",
    "Intersection": "\u22C2",
    "intlarhk": "\u2A17",
    "intprod": "\u2A3C",
    "InvisibleComma": "\u2063",
    "InvisibleTimes": "\u2062",
    "IOcy": "\u0401",
    "iocy": "\u0451",
    "Iogon": "\u012E",
    "iogon": "\u012F",
    "Iopf": "\uD835\uDD40",
    "iopf": "\uD835\uDD5A",
    "Iota": "\u0399",
    "iota": "\u03B9",
    "iprod": "\u2A3C",
    "iquest": "\u00BF",
    "Iscr": "\u2110",
    "iscr": "\uD835\uDCBE",
    "isin": "\u2208",
    "isindot": "\u22F5",
    "isinE": "\u22F9",
    "isins": "\u22F4",
    "isinsv": "\u22F3",
    "isinv": "\u2208",
    "it": "\u2062",
    "Itilde": "\u0128",
    "itilde": "\u0129",
    "Iukcy": "\u0406",
    "iukcy": "\u0456",
    "Iuml": "\u00CF",
    "iuml": "\u00EF",
    "Jcirc": "\u0134",
    "jcirc": "\u0135",
    "Jcy": "\u0419",
    "jcy": "\u0439",
    "Jfr": "\uD835\uDD0D",
    "jfr": "\uD835\uDD27",
    "jmath": "\u0237",
    "Jopf": "\uD835\uDD41",
    "jopf": "\uD835\uDD5B",
    "Jscr": "\uD835\uDCA5",
    "jscr": "\uD835\uDCBF",
    "Jsercy": "\u0408",
    "jsercy": "\u0458",
    "Jukcy": "\u0404",
    "jukcy": "\u0454",
    "Kappa": "\u039A",
    "kappa": "\u03BA",
    "kappav": "\u03F0",
    "Kcedil": "\u0136",
    "kcedil": "\u0137",
    "Kcy": "\u041A",
    "kcy": "\u043A",
    "Kfr": "\uD835\uDD0E",
    "kfr": "\uD835\uDD28",
    "kgreen": "\u0138",
    "KHcy": "\u0425",
    "khcy": "\u0445",
    "KJcy": "\u040C",
    "kjcy": "\u045C",
    "Kopf": "\uD835\uDD42",
    "kopf": "\uD835\uDD5C",
    "Kscr": "\uD835\uDCA6",
    "kscr": "\uD835\uDCC0",
    "lAarr": "\u21DA",
    "Lacute": "\u0139",
    "lacute": "\u013A",
    "laemptyv": "\u29B4",
    "lagran": "\u2112",
    "Lambda": "\u039B",
    "lambda": "\u03BB",
    "Lang": "\u27EA",
    "lang": "\u27E8",
    "langd": "\u2991",
    "langle": "\u27E8",
    "lap": "\u2A85",
    "Laplacetrf": "\u2112",
    "laquo": "\u00AB",
    "Larr": "\u219E",
    "lArr": "\u21D0",
    "larr": "\u2190",
    "larrb": "\u21E4",
    "larrbfs": "\u291F",
    "larrfs": "\u291D",
    "larrhk": "\u21A9",
    "larrlp": "\u21AB",
    "larrpl": "\u2939",
    "larrsim": "\u2973",
    "larrtl": "\u21A2",
    "lat": "\u2AAB",
    "lAtail": "\u291B",
    "latail": "\u2919",
    "late": "\u2AAD",
    "lates": "\u2AAD\uFE00",
    "lBarr": "\u290E",
    "lbarr": "\u290C",
    "lbbrk": "\u2772",
    "lbrace": "{",
    "lbrack": "[",
    "lbrke": "\u298B",
    "lbrksld": "\u298F",
    "lbrkslu": "\u298D",
    "Lcaron": "\u013D",
    "lcaron": "\u013E",
    "Lcedil": "\u013B",
    "lcedil": "\u013C",
    "lceil": "\u2308",
    "lcub": "{",
    "Lcy": "\u041B",
    "lcy": "\u043B",
    "ldca": "\u2936",
    "ldquo": "\u201C",
    "ldquor": "\u201E",
    "ldrdhar": "\u2967",
    "ldrushar": "\u294B",
    "ldsh": "\u21B2",
    "lE": "\u2266",
    "le": "\u2264",
    "LeftAngleBracket": "\u27E8",
    "LeftArrow": "\u2190",
    "Leftarrow": "\u21D0",
    "leftarrow": "\u2190",
    "LeftArrowBar": "\u21E4",
    "LeftArrowRightArrow": "\u21C6",
    "leftarrowtail": "\u21A2",
    "LeftCeiling": "\u2308",
    "LeftDoubleBracket": "\u27E6",
    "LeftDownTeeVector": "\u2961",
    "LeftDownVector": "\u21C3",
    "LeftDownVectorBar": "\u2959",
    "LeftFloor": "\u230A",
    "leftharpoondown": "\u21BD",
    "leftharpoonup": "\u21BC",
    "leftleftarrows": "\u21C7",
    "LeftRightArrow": "\u2194",
    "Leftrightarrow": "\u21D4",
    "leftrightarrow": "\u2194",
    "leftrightarrows": "\u21C6",
    "leftrightharpoons": "\u21CB",
    "leftrightsquigarrow": "\u21AD",
    "LeftRightVector": "\u294E",
    "LeftTee": "\u22A3",
    "LeftTeeArrow": "\u21A4",
    "LeftTeeVector": "\u295A",
    "leftthreetimes": "\u22CB",
    "LeftTriangle": "\u22B2",
    "LeftTriangleBar": "\u29CF",
    "LeftTriangleEqual": "\u22B4",
    "LeftUpDownVector": "\u2951",
    "LeftUpTeeVector": "\u2960",
    "LeftUpVector": "\u21BF",
    "LeftUpVectorBar": "\u2958",
    "LeftVector": "\u21BC",
    "LeftVectorBar": "\u2952",
    "lEg": "\u2A8B",
    "leg": "\u22DA",
    "leq": "\u2264",
    "leqq": "\u2266",
    "leqslant": "\u2A7D",
    "les": "\u2A7D",
    "lescc": "\u2AA8",
    "lesdot": "\u2A7F",
    "lesdoto": "\u2A81",
    "lesdotor": "\u2A83",
    "lesg": "\u22DA\uFE00",
    "lesges": "\u2A93",
    "lessapprox": "\u2A85",
    "lessdot": "\u22D6",
    "lesseqgtr": "\u22DA",
    "lesseqqgtr": "\u2A8B",
    "LessEqualGreater": "\u22DA",
    "LessFullEqual": "\u2266",
    "LessGreater": "\u2276",
    "lessgtr": "\u2276",
    "LessLess": "\u2AA1",
    "lesssim": "\u2272",
    "LessSlantEqual": "\u2A7D",
    "LessTilde": "\u2272",
    "lfisht": "\u297C",
    "lfloor": "\u230A",
    "Lfr": "\uD835\uDD0F",
    "lfr": "\uD835\uDD29",
    "lg": "\u2276",
    "lgE": "\u2A91",
    "lHar": "\u2962",
    "lhard": "\u21BD",
    "lharu": "\u21BC",
    "lharul": "\u296A",
    "lhblk": "\u2584",
    "LJcy": "\u0409",
    "ljcy": "\u0459",
    "Ll": "\u22D8",
    "ll": "\u226A",
    "llarr": "\u21C7",
    "llcorner": "\u231E",
    "Lleftarrow": "\u21DA",
    "llhard": "\u296B",
    "lltri": "\u25FA",
    "Lmidot": "\u013F",
    "lmidot": "\u0140",
    "lmoust": "\u23B0",
    "lmoustache": "\u23B0",
    "lnap": "\u2A89",
    "lnapprox": "\u2A89",
    "lnE": "\u2268",
    "lne": "\u2A87",
    "lneq": "\u2A87",
    "lneqq": "\u2268",
    "lnsim": "\u22E6",
    "loang": "\u27EC",
    "loarr": "\u21FD",
    "lobrk": "\u27E6",
    "LongLeftArrow": "\u27F5",
    "Longleftarrow": "\u27F8",
    "longleftarrow": "\u27F5",
    "LongLeftRightArrow": "\u27F7",
    "Longleftrightarrow": "\u27FA",
    "longleftrightarrow": "\u27F7",
    "longmapsto": "\u27FC",
    "LongRightArrow": "\u27F6",
    "Longrightarrow": "\u27F9",
    "longrightarrow": "\u27F6",
    "looparrowleft": "\u21AB",
    "looparrowright": "\u21AC",
    "lopar": "\u2985",
    "Lopf": "\uD835\uDD43",
    "lopf": "\uD835\uDD5D",
    "loplus": "\u2A2D",
    "lotimes": "\u2A34",
    "lowast": "\u2217",
    "lowbar": "_",
    "LowerLeftArrow": "\u2199",
    "LowerRightArrow": "\u2198",
    "loz": "\u25CA",
    "lozenge": "\u25CA",
    "lozf": "\u29EB",
    "lpar": "(",
    "lparlt": "\u2993",
    "lrarr": "\u21C6",
    "lrcorner": "\u231F",
    "lrhar": "\u21CB",
    "lrhard": "\u296D",
    "lrm": "\u200E",
    "lrtri": "\u22BF",
    "lsaquo": "\u2039",
    "Lscr": "\u2112",
    "lscr": "\uD835\uDCC1",
    "Lsh": "\u21B0",
    "lsh": "\u21B0",
    "lsim": "\u2272",
    "lsime": "\u2A8D",
    "lsimg": "\u2A8F",
    "lsqb": "[",
    "lsquo": "\u2018",
    "lsquor": "\u201A",
    "Lstrok": "\u0141",
    "lstrok": "\u0142",
    "LT": "<",
    "Lt": "\u226A",
    "lt": "<",
    "ltcc": "\u2AA6",
    "ltcir": "\u2A79",
    "ltdot": "\u22D6",
    "lthree": "\u22CB",
    "ltimes": "\u22C9",
    "ltlarr": "\u2976",
    "ltquest": "\u2A7B",
    "ltri": "\u25C3",
    "ltrie": "\u22B4",
    "ltrif": "\u25C2",
    "ltrPar": "\u2996",
    "lurdshar": "\u294A",
    "luruhar": "\u2966",
    "lvertneqq": "\u2268\uFE00",
    "lvnE": "\u2268\uFE00",
    "macr": "\u00AF",
    "male": "\u2642",
    "malt": "\u2720",
    "maltese": "\u2720",
    "Map": "\u2905",
    "map": "\u21A6",
    "mapsto": "\u21A6",
    "mapstodown": "\u21A7",
    "mapstoleft": "\u21A4",
    "mapstoup": "\u21A5",
    "marker": "\u25AE",
    "mcomma": "\u2A29",
    "Mcy": "\u041C",
    "mcy": "\u043C",
    "mdash": "\u2014",
    "mDDot": "\u223A",
    "measuredangle": "\u2221",
    "MediumSpace": "\u205F",
    "Mellintrf": "\u2133",
    "Mfr": "\uD835\uDD10",
    "mfr": "\uD835\uDD2A",
    "mho": "\u2127",
    "micro": "\u00B5",
    "mid": "\u2223",
    "midast": "*",
    "midcir": "\u2AF0",
    "middot": "\u00B7",
    "minus": "\u2212",
    "minusb": "\u229F",
    "minusd": "\u2238",
    "minusdu": "\u2A2A",
    "MinusPlus": "\u2213",
    "mlcp": "\u2ADB",
    "mldr": "\u2026",
    "mnplus": "\u2213",
    "models": "\u22A7",
    "Mopf": "\uD835\uDD44",
    "mopf": "\uD835\uDD5E",
    "mp": "\u2213",
    "Mscr": "\u2133",
    "mscr": "\uD835\uDCC2",
    "mstpos": "\u223E",
    "Mu": "\u039C",
    "mu": "\u03BC",
    "multimap": "\u22B8",
    "mumap": "\u22B8",
    "nabla": "\u2207",
    "Nacute": "\u0143",
    "nacute": "\u0144",
    "nang": "\u2220\u20D2",
    "nap": "\u2249",
    "napE": "\u2A70\u0338",
    "napid": "\u224B\u0338",
    "napos": "\u0149",
    "napprox": "\u2249",
    "natur": "\u266E",
    "natural": "\u266E",
    "naturals": "\u2115",
    "nbsp": "\u00A0",
    "nbump": "\u224E\u0338",
    "nbumpe": "\u224F\u0338",
    "ncap": "\u2A43",
    "Ncaron": "\u0147",
    "ncaron": "\u0148",
    "Ncedil": "\u0145",
    "ncedil": "\u0146",
    "ncong": "\u2247",
    "ncongdot": "\u2A6D\u0338",
    "ncup": "\u2A42",
    "Ncy": "\u041D",
    "ncy": "\u043D",
    "ndash": "\u2013",
    "ne": "\u2260",
    "nearhk": "\u2924",
    "neArr": "\u21D7",
    "nearr": "\u2197",
    "nearrow": "\u2197",
    "nedot": "\u2250\u0338",
    "NegativeMediumSpace": "\u200B",
    "NegativeThickSpace": "\u200B",
    "NegativeThinSpace": "\u200B",
    "NegativeVeryThinSpace": "\u200B",
    "nequiv": "\u2262",
    "nesear": "\u2928",
    "nesim": "\u2242\u0338",
    "NestedGreaterGreater": "\u226B",
    "NestedLessLess": "\u226A",
    "NewLine": "\n",
    "nexist": "\u2204",
    "nexists": "\u2204",
    "Nfr": "\uD835\uDD11",
    "nfr": "\uD835\uDD2B",
    "ngE": "\u2267\u0338",
    "nge": "\u2271",
    "ngeq": "\u2271",
    "ngeqq": "\u2267\u0338",
    "ngeqslant": "\u2A7E\u0338",
    "nges": "\u2A7E\u0338",
    "nGg": "\u22D9\u0338",
    "ngsim": "\u2275",
    "nGt": "\u226B\u20D2",
    "ngt": "\u226F",
    "ngtr": "\u226F",
    "nGtv": "\u226B\u0338",
    "nhArr": "\u21CE",
    "nharr": "\u21AE",
    "nhpar": "\u2AF2",
    "ni": "\u220B",
    "nis": "\u22FC",
    "nisd": "\u22FA",
    "niv": "\u220B",
    "NJcy": "\u040A",
    "njcy": "\u045A",
    "nlArr": "\u21CD",
    "nlarr": "\u219A",
    "nldr": "\u2025",
    "nlE": "\u2266\u0338",
    "nle": "\u2270",
    "nLeftarrow": "\u21CD",
    "nleftarrow": "\u219A",
    "nLeftrightarrow": "\u21CE",
    "nleftrightarrow": "\u21AE",
    "nleq": "\u2270",
    "nleqq": "\u2266\u0338",
    "nleqslant": "\u2A7D\u0338",
    "nles": "\u2A7D\u0338",
    "nless": "\u226E",
    "nLl": "\u22D8\u0338",
    "nlsim": "\u2274",
    "nLt": "\u226A\u20D2",
    "nlt": "\u226E",
    "nltri": "\u22EA",
    "nltrie": "\u22EC",
    "nLtv": "\u226A\u0338",
    "nmid": "\u2224",
    "NoBreak": "\u2060",
    "NonBreakingSpace": "\u00A0",
    "Nopf": "\u2115",
    "nopf": "\uD835\uDD5F",
    "Not": "\u2AEC",
    "not": "\u00AC",
    "NotCongruent": "\u2262",
    "NotCupCap": "\u226D",
    "NotDoubleVerticalBar": "\u2226",
    "NotElement": "\u2209",
    "NotEqual": "\u2260",
    "NotEqualTilde": "\u2242\u0338",
    "NotExists": "\u2204",
    "NotGreater": "\u226F",
    "NotGreaterEqual": "\u2271",
    "NotGreaterFullEqual": "\u2267\u0338",
    "NotGreaterGreater": "\u226B\u0338",
    "NotGreaterLess": "\u2279",
    "NotGreaterSlantEqual": "\u2A7E\u0338",
    "NotGreaterTilde": "\u2275",
    "NotHumpDownHump": "\u224E\u0338",
    "NotHumpEqual": "\u224F\u0338",
    "notin": "\u2209",
    "notindot": "\u22F5\u0338",
    "notinE": "\u22F9\u0338",
    "notinva": "\u2209",
    "notinvb": "\u22F7",
    "notinvc": "\u22F6",
    "NotLeftTriangle": "\u22EA",
    "NotLeftTriangleBar": "\u29CF\u0338",
    "NotLeftTriangleEqual": "\u22EC",
    "NotLess": "\u226E",
    "NotLessEqual": "\u2270",
    "NotLessGreater": "\u2278",
    "NotLessLess": "\u226A\u0338",
    "NotLessSlantEqual": "\u2A7D\u0338",
    "NotLessTilde": "\u2274",
    "NotNestedGreaterGreater": "\u2AA2\u0338",
    "NotNestedLessLess": "\u2AA1\u0338",
    "notni": "\u220C",
    "notniva": "\u220C",
    "notnivb": "\u22FE",
    "notnivc": "\u22FD",
    "NotPrecedes": "\u2280",
    "NotPrecedesEqual": "\u2AAF\u0338",
    "NotPrecedesSlantEqual": "\u22E0",
    "NotReverseElement": "\u220C",
    "NotRightTriangle": "\u22EB",
    "NotRightTriangleBar": "\u29D0\u0338",
    "NotRightTriangleEqual": "\u22ED",
    "NotSquareSubset": "\u228F\u0338",
    "NotSquareSubsetEqual": "\u22E2",
    "NotSquareSuperset": "\u2290\u0338",
    "NotSquareSupersetEqual": "\u22E3",
    "NotSubset": "\u2282\u20D2",
    "NotSubsetEqual": "\u2288",
    "NotSucceeds": "\u2281",
    "NotSucceedsEqual": "\u2AB0\u0338",
    "NotSucceedsSlantEqual": "\u22E1",
    "NotSucceedsTilde": "\u227F\u0338",
    "NotSuperset": "\u2283\u20D2",
    "NotSupersetEqual": "\u2289",
    "NotTilde": "\u2241",
    "NotTildeEqual": "\u2244",
    "NotTildeFullEqual": "\u2247",
    "NotTildeTilde": "\u2249",
    "NotVerticalBar": "\u2224",
    "npar": "\u2226",
    "nparallel": "\u2226",
    "nparsl": "\u2AFD\u20E5",
    "npart": "\u2202\u0338",
    "npolint": "\u2A14",
    "npr": "\u2280",
    "nprcue": "\u22E0",
    "npre": "\u2AAF\u0338",
    "nprec": "\u2280",
    "npreceq": "\u2AAF\u0338",
    "nrArr": "\u21CF",
    "nrarr": "\u219B",
    "nrarrc": "\u2933\u0338",
    "nrarrw": "\u219D\u0338",
    "nRightarrow": "\u21CF",
    "nrightarrow": "\u219B",
    "nrtri": "\u22EB",
    "nrtrie": "\u22ED",
    "nsc": "\u2281",
    "nsccue": "\u22E1",
    "nsce": "\u2AB0\u0338",
    "Nscr": "\uD835\uDCA9",
    "nscr": "\uD835\uDCC3",
    "nshortmid": "\u2224",
    "nshortparallel": "\u2226",
    "nsim": "\u2241",
    "nsime": "\u2244",
    "nsimeq": "\u2244",
    "nsmid": "\u2224",
    "nspar": "\u2226",
    "nsqsube": "\u22E2",
    "nsqsupe": "\u22E3",
    "nsub": "\u2284",
    "nsubE": "\u2AC5\u0338",
    "nsube": "\u2288",
    "nsubset": "\u2282\u20D2",
    "nsubseteq": "\u2288",
    "nsubseteqq": "\u2AC5\u0338",
    "nsucc": "\u2281",
    "nsucceq": "\u2AB0\u0338",
    "nsup": "\u2285",
    "nsupE": "\u2AC6\u0338",
    "nsupe": "\u2289",
    "nsupset": "\u2283\u20D2",
    "nsupseteq": "\u2289",
    "nsupseteqq": "\u2AC6\u0338",
    "ntgl": "\u2279",
    "Ntilde": "\u00D1",
    "ntilde": "\u00F1",
    "ntlg": "\u2278",
    "ntriangleleft": "\u22EA",
    "ntrianglelefteq": "\u22EC",
    "ntriangleright": "\u22EB",
    "ntrianglerighteq": "\u22ED",
    "Nu": "\u039D",
    "nu": "\u03BD",
    "num": "#",
    "numero": "\u2116",
    "numsp": "\u2007",
    "nvap": "\u224D\u20D2",
    "nVDash": "\u22AF",
    "nVdash": "\u22AE",
    "nvDash": "\u22AD",
    "nvdash": "\u22AC",
    "nvge": "\u2265\u20D2",
    "nvgt": ">\u20D2",
    "nvHarr": "\u2904",
    "nvinfin": "\u29DE",
    "nvlArr": "\u2902",
    "nvle": "\u2264\u20D2",
    "nvlt": "<\u20D2",
    "nvltrie": "\u22B4\u20D2",
    "nvrArr": "\u2903",
    "nvrtrie": "\u22B5\u20D2",
    "nvsim": "\u223C\u20D2",
    "nwarhk": "\u2923",
    "nwArr": "\u21D6",
    "nwarr": "\u2196",
    "nwarrow": "\u2196",
    "nwnear": "\u2927",
    "Oacute": "\u00D3",
    "oacute": "\u00F3",
    "oast": "\u229B",
    "ocir": "\u229A",
    "Ocirc": "\u00D4",
    "ocirc": "\u00F4",
    "Ocy": "\u041E",
    "ocy": "\u043E",
    "odash": "\u229D",
    "Odblac": "\u0150",
    "odblac": "\u0151",
    "odiv": "\u2A38",
    "odot": "\u2299",
    "odsold": "\u29BC",
    "OElig": "\u0152",
    "oelig": "\u0153",
    "ofcir": "\u29BF",
    "Ofr": "\uD835\uDD12",
    "ofr": "\uD835\uDD2C",
    "ogon": "\u02DB",
    "Ograve": "\u00D2",
    "ograve": "\u00F2",
    "ogt": "\u29C1",
    "ohbar": "\u29B5",
    "ohm": "\u03A9",
    "oint": "\u222E",
    "olarr": "\u21BA",
    "olcir": "\u29BE",
    "olcross": "\u29BB",
    "oline": "\u203E",
    "olt": "\u29C0",
    "Omacr": "\u014C",
    "omacr": "\u014D",
    "Omega": "\u03A9",
    "omega": "\u03C9",
    "Omicron": "\u039F",
    "omicron": "\u03BF",
    "omid": "\u29B6",
    "ominus": "\u2296",
    "Oopf": "\uD835\uDD46",
    "oopf": "\uD835\uDD60",
    "opar": "\u29B7",
    "OpenCurlyDoubleQuote": "\u201C",
    "OpenCurlyQuote": "\u2018",
    "operp": "\u29B9",
    "oplus": "\u2295",
    "Or": "\u2A54",
    "or": "\u2228",
    "orarr": "\u21BB",
    "ord": "\u2A5D",
    "order": "\u2134",
    "orderof": "\u2134",
    "ordf": "\u00AA",
    "ordm": "\u00BA",
    "origof": "\u22B6",
    "oror": "\u2A56",
    "orslope": "\u2A57",
    "orv": "\u2A5B",
    "oS": "\u24C8",
    "Oscr": "\uD835\uDCAA",
    "oscr": "\u2134",
    "Oslash": "\u00D8",
    "oslash": "\u00F8",
    "osol": "\u2298",
    "Otilde": "\u00D5",
    "otilde": "\u00F5",
    "Otimes": "\u2A37",
    "otimes": "\u2297",
    "otimesas": "\u2A36",
    "Ouml": "\u00D6",
    "ouml": "\u00F6",
    "ovbar": "\u233D",
    "OverBar": "\u203E",
    "OverBrace": "\u23DE",
    "OverBracket": "\u23B4",
    "OverParenthesis": "\u23DC",
    "par": "\u2225",
    "para": "\u00B6",
    "parallel": "\u2225",
    "parsim": "\u2AF3",
    "parsl": "\u2AFD",
    "part": "\u2202",
    "PartialD": "\u2202",
    "Pcy": "\u041F",
    "pcy": "\u043F",
    "percnt": "%",
    "period": ".",
    "permil": "\u2030",
    "perp": "\u22A5",
    "pertenk": "\u2031",
    "Pfr": "\uD835\uDD13",
    "pfr": "\uD835\uDD2D",
    "Phi": "\u03A6",
    "phi": "\u03C6",
    "phiv": "\u03D5",
    "phmmat": "\u2133",
    "phone": "\u260E",
    "Pi": "\u03A0",
    "pi": "\u03C0",
    "pitchfork": "\u22D4",
    "piv": "\u03D6",
    "planck": "\u210F",
    "planckh": "\u210E",
    "plankv": "\u210F",
    "plus": "+",
    "plusacir": "\u2A23",
    "plusb": "\u229E",
    "pluscir": "\u2A22",
    "plusdo": "\u2214",
    "plusdu": "\u2A25",
    "pluse": "\u2A72",
    "PlusMinus": "\u00B1",
    "plusmn": "\u00B1",
    "plussim": "\u2A26",
    "plustwo": "\u2A27",
    "pm": "\u00B1",
    "Poincareplane": "\u210C",
    "pointint": "\u2A15",
    "Popf": "\u2119",
    "popf": "\uD835\uDD61",
    "pound": "\u00A3",
    "Pr": "\u2ABB",
    "pr": "\u227A",
    "prap": "\u2AB7",
    "prcue": "\u227C",
    "prE": "\u2AB3",
    "pre": "\u2AAF",
    "prec": "\u227A",
    "precapprox": "\u2AB7",
    "preccurlyeq": "\u227C",
    "Precedes": "\u227A",
    "PrecedesEqual": "\u2AAF",
    "PrecedesSlantEqual": "\u227C",
    "PrecedesTilde": "\u227E",
    "preceq": "\u2AAF",
    "precnapprox": "\u2AB9",
    "precneqq": "\u2AB5",
    "precnsim": "\u22E8",
    "precsim": "\u227E",
    "Prime": "\u2033",
    "prime": "\u2032",
    "primes": "\u2119",
    "prnap": "\u2AB9",
    "prnE": "\u2AB5",
    "prnsim": "\u22E8",
    "prod": "\u220F",
    "Product": "\u220F",
    "profalar": "\u232E",
    "profline": "\u2312",
    "profsurf": "\u2313",
    "prop": "\u221D",
    "Proportion": "\u2237",
    "Proportional": "\u221D",
    "propto": "\u221D",
    "prsim": "\u227E",
    "prurel": "\u22B0",
    "Pscr": "\uD835\uDCAB",
    "pscr": "\uD835\uDCC5",
    "Psi": "\u03A8",
    "psi": "\u03C8",
    "puncsp": "\u2008",
    "Qfr": "\uD835\uDD14",
    "qfr": "\uD835\uDD2E",
    "qint": "\u2A0C",
    "Qopf": "\u211A",
    "qopf": "\uD835\uDD62",
    "qprime": "\u2057",
    "Qscr": "\uD835\uDCAC",
    "qscr": "\uD835\uDCC6",
    "quaternions": "\u210D",
    "quatint": "\u2A16",
    "quest": "?",
    "questeq": "\u225F",
    "QUOT": "\"",
    "quot": "\"",
    "rAarr": "\u21DB",
    "race": "\u223D\u0331",
    "Racute": "\u0154",
    "racute": "\u0155",
    "radic": "\u221A",
    "raemptyv": "\u29B3",
    "Rang": "\u27EB",
    "rang": "\u27E9",
    "rangd": "\u2992",
    "range": "\u29A5",
    "rangle": "\u27E9",
    "raquo": "\u00BB",
    "Rarr": "\u21A0",
    "rArr": "\u21D2",
    "rarr": "\u2192",
    "rarrap": "\u2975",
    "rarrb": "\u21E5",
    "rarrbfs": "\u2920",
    "rarrc": "\u2933",
    "rarrfs": "\u291E",
    "rarrhk": "\u21AA",
    "rarrlp": "\u21AC",
    "rarrpl": "\u2945",
    "rarrsim": "\u2974",
    "Rarrtl": "\u2916",
    "rarrtl": "\u21A3",
    "rarrw": "\u219D",
    "rAtail": "\u291C",
    "ratail": "\u291A",
    "ratio": "\u2236",
    "rationals": "\u211A",
    "RBarr": "\u2910",
    "rBarr": "\u290F",
    "rbarr": "\u290D",
    "rbbrk": "\u2773",
    "rbrace": "}",
    "rbrack": "]",
    "rbrke": "\u298C",
    "rbrksld": "\u298E",
    "rbrkslu": "\u2990",
    "Rcaron": "\u0158",
    "rcaron": "\u0159",
    "Rcedil": "\u0156",
    "rcedil": "\u0157",
    "rceil": "\u2309",
    "rcub": "}",
    "Rcy": "\u0420",
    "rcy": "\u0440",
    "rdca": "\u2937",
    "rdldhar": "\u2969",
    "rdquo": "\u201D",
    "rdquor": "\u201D",
    "rdsh": "\u21B3",
    "Re": "\u211C",
    "real": "\u211C",
    "realine": "\u211B",
    "realpart": "\u211C",
    "reals": "\u211D",
    "rect": "\u25AD",
    "REG": "\u00AE",
    "reg": "\u00AE",
    "ReverseElement": "\u220B",
    "ReverseEquilibrium": "\u21CB",
    "ReverseUpEquilibrium": "\u296F",
    "rfisht": "\u297D",
    "rfloor": "\u230B",
    "Rfr": "\u211C",
    "rfr": "\uD835\uDD2F",
    "rHar": "\u2964",
    "rhard": "\u21C1",
    "rharu": "\u21C0",
    "rharul": "\u296C",
    "Rho": "\u03A1",
    "rho": "\u03C1",
    "rhov": "\u03F1",
    "RightAngleBracket": "\u27E9",
    "RightArrow": "\u2192",
    "Rightarrow": "\u21D2",
    "rightarrow": "\u2192",
    "RightArrowBar": "\u21E5",
    "RightArrowLeftArrow": "\u21C4",
    "rightarrowtail": "\u21A3",
    "RightCeiling": "\u2309",
    "RightDoubleBracket": "\u27E7",
    "RightDownTeeVector": "\u295D",
    "RightDownVector": "\u21C2",
    "RightDownVectorBar": "\u2955",
    "RightFloor": "\u230B",
    "rightharpoondown": "\u21C1",
    "rightharpoonup": "\u21C0",
    "rightleftarrows": "\u21C4",
    "rightleftharpoons": "\u21CC",
    "rightrightarrows": "\u21C9",
    "rightsquigarrow": "\u219D",
    "RightTee": "\u22A2",
    "RightTeeArrow": "\u21A6",
    "RightTeeVector": "\u295B",
    "rightthreetimes": "\u22CC",
    "RightTriangle": "\u22B3",
    "RightTriangleBar": "\u29D0",
    "RightTriangleEqual": "\u22B5",
    "RightUpDownVector": "\u294F",
    "RightUpTeeVector": "\u295C",
    "RightUpVector": "\u21BE",
    "RightUpVectorBar": "\u2954",
    "RightVector": "\u21C0",
    "RightVectorBar": "\u2953",
    "ring": "\u02DA",
    "risingdotseq": "\u2253",
    "rlarr": "\u21C4",
    "rlhar": "\u21CC",
    "rlm": "\u200F",
    "rmoust": "\u23B1",
    "rmoustache": "\u23B1",
    "rnmid": "\u2AEE",
    "roang": "\u27ED",
    "roarr": "\u21FE",
    "robrk": "\u27E7",
    "ropar": "\u2986",
    "Ropf": "\u211D",
    "ropf": "\uD835\uDD63",
    "roplus": "\u2A2E",
    "rotimes": "\u2A35",
    "RoundImplies": "\u2970",
    "rpar": ")",
    "rpargt": "\u2994",
    "rppolint": "\u2A12",
    "rrarr": "\u21C9",
    "Rrightarrow": "\u21DB",
    "rsaquo": "\u203A",
    "Rscr": "\u211B",
    "rscr": "\uD835\uDCC7",
    "Rsh": "\u21B1",
    "rsh": "\u21B1",
    "rsqb": "]",
    "rsquo": "\u2019",
    "rsquor": "\u2019",
    "rthree": "\u22CC",
    "rtimes": "\u22CA",
    "rtri": "\u25B9",
    "rtrie": "\u22B5",
    "rtrif": "\u25B8",
    "rtriltri": "\u29CE",
    "RuleDelayed": "\u29F4",
    "ruluhar": "\u2968",
    "rx": "\u211E",
    "Sacute": "\u015A",
    "sacute": "\u015B",
    "sbquo": "\u201A",
    "Sc": "\u2ABC",
    "sc": "\u227B",
    "scap": "\u2AB8",
    "Scaron": "\u0160",
    "scaron": "\u0161",
    "sccue": "\u227D",
    "scE": "\u2AB4",
    "sce": "\u2AB0",
    "Scedil": "\u015E",
    "scedil": "\u015F",
    "Scirc": "\u015C",
    "scirc": "\u015D",
    "scnap": "\u2ABA",
    "scnE": "\u2AB6",
    "scnsim": "\u22E9",
    "scpolint": "\u2A13",
    "scsim": "\u227F",
    "Scy": "\u0421",
    "scy": "\u0441",
    "sdot": "\u22C5",
    "sdotb": "\u22A1",
    "sdote": "\u2A66",
    "searhk": "\u2925",
    "seArr": "\u21D8",
    "searr": "\u2198",
    "searrow": "\u2198",
    "sect": "\u00A7",
    "semi": ";",
    "seswar": "\u2929",
    "setminus": "\u2216",
    "setmn": "\u2216",
    "sext": "\u2736",
    "Sfr": "\uD835\uDD16",
    "sfr": "\uD835\uDD30",
    "sfrown": "\u2322",
    "sharp": "\u266F",
    "SHCHcy": "\u0429",
    "shchcy": "\u0449",
    "SHcy": "\u0428",
    "shcy": "\u0448",
    "ShortDownArrow": "\u2193",
    "ShortLeftArrow": "\u2190",
    "shortmid": "\u2223",
    "shortparallel": "\u2225",
    "ShortRightArrow": "\u2192",
    "ShortUpArrow": "\u2191",
    "shy": "\u00AD",
    "Sigma": "\u03A3",
    "sigma": "\u03C3",
    "sigmaf": "\u03C2",
    "sigmav": "\u03C2",
    "sim": "\u223C",
    "simdot": "\u2A6A",
    "sime": "\u2243",
    "simeq": "\u2243",
    "simg": "\u2A9E",
    "simgE": "\u2AA0",
    "siml": "\u2A9D",
    "simlE": "\u2A9F",
    "simne": "\u2246",
    "simplus": "\u2A24",
    "simrarr": "\u2972",
    "slarr": "\u2190",
    "SmallCircle": "\u2218",
    "smallsetminus": "\u2216",
    "smashp": "\u2A33",
    "smeparsl": "\u29E4",
    "smid": "\u2223",
    "smile": "\u2323",
    "smt": "\u2AAA",
    "smte": "\u2AAC",
    "smtes": "\u2AAC\uFE00",
    "SOFTcy": "\u042C",
    "softcy": "\u044C",
    "sol": "/",
    "solb": "\u29C4",
    "solbar": "\u233F",
    "Sopf": "\uD835\uDD4A",
    "sopf": "\uD835\uDD64",
    "spades": "\u2660",
    "spadesuit": "\u2660",
    "spar": "\u2225",
    "sqcap": "\u2293",
    "sqcaps": "\u2293\uFE00",
    "sqcup": "\u2294",
    "sqcups": "\u2294\uFE00",
    "Sqrt": "\u221A",
    "sqsub": "\u228F",
    "sqsube": "\u2291",
    "sqsubset": "\u228F",
    "sqsubseteq": "\u2291",
    "sqsup": "\u2290",
    "sqsupe": "\u2292",
    "sqsupset": "\u2290",
    "sqsupseteq": "\u2292",
    "squ": "\u25A1",
    "Square": "\u25A1",
    "square": "\u25A1",
    "SquareIntersection": "\u2293",
    "SquareSubset": "\u228F",
    "SquareSubsetEqual": "\u2291",
    "SquareSuperset": "\u2290",
    "SquareSupersetEqual": "\u2292",
    "SquareUnion": "\u2294",
    "squarf": "\u25AA",
    "squf": "\u25AA",
    "srarr": "\u2192",
    "Sscr": "\uD835\uDCAE",
    "sscr": "\uD835\uDCC8",
    "ssetmn": "\u2216",
    "ssmile": "\u2323",
    "sstarf": "\u22C6",
    "Star": "\u22C6",
    "star": "\u2606",
    "starf": "\u2605",
    "straightepsilon": "\u03F5",
    "straightphi": "\u03D5",
    "strns": "\u00AF",
    "Sub": "\u22D0",
    "sub": "\u2282",
    "subdot": "\u2ABD",
    "subE": "\u2AC5",
    "sube": "\u2286",
    "subedot": "\u2AC3",
    "submult": "\u2AC1",
    "subnE": "\u2ACB",
    "subne": "\u228A",
    "subplus": "\u2ABF",
    "subrarr": "\u2979",
    "Subset": "\u22D0",
    "subset": "\u2282",
    "subseteq": "\u2286",
    "subseteqq": "\u2AC5",
    "SubsetEqual": "\u2286",
    "subsetneq": "\u228A",
    "subsetneqq": "\u2ACB",
    "subsim": "\u2AC7",
    "subsub": "\u2AD5",
    "subsup": "\u2AD3",
    "succ": "\u227B",
    "succapprox": "\u2AB8",
    "succcurlyeq": "\u227D",
    "Succeeds": "\u227B",
    "SucceedsEqual": "\u2AB0",
    "SucceedsSlantEqual": "\u227D",
    "SucceedsTilde": "\u227F",
    "succeq": "\u2AB0",
    "succnapprox": "\u2ABA",
    "succneqq": "\u2AB6",
    "succnsim": "\u22E9",
    "succsim": "\u227F",
    "SuchThat": "\u220B",
    "Sum": "\u2211",
    "sum": "\u2211",
    "sung": "\u266A",
    "Sup": "\u22D1",
    "sup": "\u2283",
    "sup1": "\u00B9",
    "sup2": "\u00B2",
    "sup3": "\u00B3",
    "supdot": "\u2ABE",
    "supdsub": "\u2AD8",
    "supE": "\u2AC6",
    "supe": "\u2287",
    "supedot": "\u2AC4",
    "Superset": "\u2283",
    "SupersetEqual": "\u2287",
    "suphsol": "\u27C9",
    "suphsub": "\u2AD7",
    "suplarr": "\u297B",
    "supmult": "\u2AC2",
    "supnE": "\u2ACC",
    "supne": "\u228B",
    "supplus": "\u2AC0",
    "Supset": "\u22D1",
    "supset": "\u2283",
    "supseteq": "\u2287",
    "supseteqq": "\u2AC6",
    "supsetneq": "\u228B",
    "supsetneqq": "\u2ACC",
    "supsim": "\u2AC8",
    "supsub": "\u2AD4",
    "supsup": "\u2AD6",
    "swarhk": "\u2926",
    "swArr": "\u21D9",
    "swarr": "\u2199",
    "swarrow": "\u2199",
    "swnwar": "\u292A",
    "szlig": "\u00DF",
    "Tab": "\t",
    "target": "\u2316",
    "Tau": "\u03A4",
    "tau": "\u03C4",
    "tbrk": "\u23B4",
    "Tcaron": "\u0164",
    "tcaron": "\u0165",
    "Tcedil": "\u0162",
    "tcedil": "\u0163",
    "Tcy": "\u0422",
    "tcy": "\u0442",
    "tdot": "\u20DB",
    "telrec": "\u2315",
    "Tfr": "\uD835\uDD17",
    "tfr": "\uD835\uDD31",
    "there4": "\u2234",
    "Therefore": "\u2234",
    "therefore": "\u2234",
    "Theta": "\u0398",
    "theta": "\u03B8",
    "thetasym": "\u03D1",
    "thetav": "\u03D1",
    "thickapprox": "\u2248",
    "thicksim": "\u223C",
    "ThickSpace": "\u205F\u200A",
    "thinsp": "\u2009",
    "ThinSpace": "\u2009",
    "thkap": "\u2248",
    "thksim": "\u223C",
    "THORN": "\u00DE",
    "thorn": "\u00FE",
    "Tilde": "\u223C",
    "tilde": "\u02DC",
    "TildeEqual": "\u2243",
    "TildeFullEqual": "\u2245",
    "TildeTilde": "\u2248",
    "times": "\u00D7",
    "timesb": "\u22A0",
    "timesbar": "\u2A31",
    "timesd": "\u2A30",
    "tint": "\u222D",
    "toea": "\u2928",
    "top": "\u22A4",
    "topbot": "\u2336",
    "topcir": "\u2AF1",
    "Topf": "\uD835\uDD4B",
    "topf": "\uD835\uDD65",
    "topfork": "\u2ADA",
    "tosa": "\u2929",
    "tprime": "\u2034",
    "TRADE": "\u2122",
    "trade": "\u2122",
    "triangle": "\u25B5",
    "triangledown": "\u25BF",
    "triangleleft": "\u25C3",
    "trianglelefteq": "\u22B4",
    "triangleq": "\u225C",
    "triangleright": "\u25B9",
    "trianglerighteq": "\u22B5",
    "tridot": "\u25EC",
    "trie": "\u225C",
    "triminus": "\u2A3A",
    "TripleDot": "\u20DB",
    "triplus": "\u2A39",
    "trisb": "\u29CD",
    "tritime": "\u2A3B",
    "trpezium": "\u23E2",
    "Tscr": "\uD835\uDCAF",
    "tscr": "\uD835\uDCC9",
    "TScy": "\u0426",
    "tscy": "\u0446",
    "TSHcy": "\u040B",
    "tshcy": "\u045B",
    "Tstrok": "\u0166",
    "tstrok": "\u0167",
    "twixt": "\u226C",
    "twoheadleftarrow": "\u219E",
    "twoheadrightarrow": "\u21A0",
    "Uacute": "\u00DA",
    "uacute": "\u00FA",
    "Uarr": "\u219F",
    "uArr": "\u21D1",
    "uarr": "\u2191",
    "Uarrocir": "\u2949",
    "Ubrcy": "\u040E",
    "ubrcy": "\u045E",
    "Ubreve": "\u016C",
    "ubreve": "\u016D",
    "Ucirc": "\u00DB",
    "ucirc": "\u00FB",
    "Ucy": "\u0423",
    "ucy": "\u0443",
    "udarr": "\u21C5",
    "Udblac": "\u0170",
    "udblac": "\u0171",
    "udhar": "\u296E",
    "ufisht": "\u297E",
    "Ufr": "\uD835\uDD18",
    "ufr": "\uD835\uDD32",
    "Ugrave": "\u00D9",
    "ugrave": "\u00F9",
    "uHar": "\u2963",
    "uharl": "\u21BF",
    "uharr": "\u21BE",
    "uhblk": "\u2580",
    "ulcorn": "\u231C",
    "ulcorner": "\u231C",
    "ulcrop": "\u230F",
    "ultri": "\u25F8",
    "Umacr": "\u016A",
    "umacr": "\u016B",
    "uml": "\u00A8",
    "UnderBar": "_",
    "UnderBrace": "\u23DF",
    "UnderBracket": "\u23B5",
    "UnderParenthesis": "\u23DD",
    "Union": "\u22C3",
    "UnionPlus": "\u228E",
    "Uogon": "\u0172",
    "uogon": "\u0173",
    "Uopf": "\uD835\uDD4C",
    "uopf": "\uD835\uDD66",
    "UpArrow": "\u2191",
    "Uparrow": "\u21D1",
    "uparrow": "\u2191",
    "UpArrowBar": "\u2912",
    "UpArrowDownArrow": "\u21C5",
    "UpDownArrow": "\u2195",
    "Updownarrow": "\u21D5",
    "updownarrow": "\u2195",
    "UpEquilibrium": "\u296E",
    "upharpoonleft": "\u21BF",
    "upharpoonright": "\u21BE",
    "uplus": "\u228E",
    "UpperLeftArrow": "\u2196",
    "UpperRightArrow": "\u2197",
    "Upsi": "\u03D2",
    "upsi": "\u03C5",
    "upsih": "\u03D2",
    "Upsilon": "\u03A5",
    "upsilon": "\u03C5",
    "UpTee": "\u22A5",
    "UpTeeArrow": "\u21A5",
    "upuparrows": "\u21C8",
    "urcorn": "\u231D",
    "urcorner": "\u231D",
    "urcrop": "\u230E",
    "Uring": "\u016E",
    "uring": "\u016F",
    "urtri": "\u25F9",
    "Uscr": "\uD835\uDCB0",
    "uscr": "\uD835\uDCCA",
    "utdot": "\u22F0",
    "Utilde": "\u0168",
    "utilde": "\u0169",
    "utri": "\u25B5",
    "utrif": "\u25B4",
    "uuarr": "\u21C8",
    "Uuml": "\u00DC",
    "uuml": "\u00FC",
    "uwangle": "\u29A7",
    "vangrt": "\u299C",
    "varepsilon": "\u03F5",
    "varkappa": "\u03F0",
    "varnothing": "\u2205",
    "varphi": "\u03D5",
    "varpi": "\u03D6",
    "varpropto": "\u221D",
    "vArr": "\u21D5",
    "varr": "\u2195",
    "varrho": "\u03F1",
    "varsigma": "\u03C2",
    "varsubsetneq": "\u228A\uFE00",
    "varsubsetneqq": "\u2ACB\uFE00",
    "varsupsetneq": "\u228B\uFE00",
    "varsupsetneqq": "\u2ACC\uFE00",
    "vartheta": "\u03D1",
    "vartriangleleft": "\u22B2",
    "vartriangleright": "\u22B3",
    "Vbar": "\u2AEB",
    "vBar": "\u2AE8",
    "vBarv": "\u2AE9",
    "Vcy": "\u0412",
    "vcy": "\u0432",
    "VDash": "\u22AB",
    "Vdash": "\u22A9",
    "vDash": "\u22A8",
    "vdash": "\u22A2",
    "Vdashl": "\u2AE6",
    "Vee": "\u22C1",
    "vee": "\u2228",
    "veebar": "\u22BB",
    "veeeq": "\u225A",
    "vellip": "\u22EE",
    "Verbar": "\u2016",
    "verbar": "|",
    "Vert": "\u2016",
    "vert": "|",
    "VerticalBar": "\u2223",
    "VerticalLine": "|",
    "VerticalSeparator": "\u2758",
    "VerticalTilde": "\u2240",
    "VeryThinSpace": "\u200A",
    "Vfr": "\uD835\uDD19",
    "vfr": "\uD835\uDD33",
    "vltri": "\u22B2",
    "vnsub": "\u2282\u20D2",
    "vnsup": "\u2283\u20D2",
    "Vopf": "\uD835\uDD4D",
    "vopf": "\uD835\uDD67",
    "vprop": "\u221D",
    "vrtri": "\u22B3",
    "Vscr": "\uD835\uDCB1",
    "vscr": "\uD835\uDCCB",
    "vsubnE": "\u2ACB\uFE00",
    "vsubne": "\u228A\uFE00",
    "vsupnE": "\u2ACC\uFE00",
    "vsupne": "\u228B\uFE00",
    "Vvdash": "\u22AA",
    "vzigzag": "\u299A",
    "Wcirc": "\u0174",
    "wcirc": "\u0175",
    "wedbar": "\u2A5F",
    "Wedge": "\u22C0",
    "wedge": "\u2227",
    "wedgeq": "\u2259",
    "weierp": "\u2118",
    "Wfr": "\uD835\uDD1A",
    "wfr": "\uD835\uDD34",
    "Wopf": "\uD835\uDD4E",
    "wopf": "\uD835\uDD68",
    "wp": "\u2118",
    "wr": "\u2240",
    "wreath": "\u2240",
    "Wscr": "\uD835\uDCB2",
    "wscr": "\uD835\uDCCC",
    "xcap": "\u22C2",
    "xcirc": "\u25EF",
    "xcup": "\u22C3",
    "xdtri": "\u25BD",
    "Xfr": "\uD835\uDD1B",
    "xfr": "\uD835\uDD35",
    "xhArr": "\u27FA",
    "xharr": "\u27F7",
    "Xi": "\u039E",
    "xi": "\u03BE",
    "xlArr": "\u27F8",
    "xlarr": "\u27F5",
    "xmap": "\u27FC",
    "xnis": "\u22FB",
    "xodot": "\u2A00",
    "Xopf": "\uD835\uDD4F",
    "xopf": "\uD835\uDD69",
    "xoplus": "\u2A01",
    "xotime": "\u2A02",
    "xrArr": "\u27F9",
    "xrarr": "\u27F6",
    "Xscr": "\uD835\uDCB3",
    "xscr": "\uD835\uDCCD",
    "xsqcup": "\u2A06",
    "xuplus": "\u2A04",
    "xutri": "\u25B3",
    "xvee": "\u22C1",
    "xwedge": "\u22C0",
    "Yacute": "\u00DD",
    "yacute": "\u00FD",
    "YAcy": "\u042F",
    "yacy": "\u044F",
    "Ycirc": "\u0176",
    "ycirc": "\u0177",
    "Ycy": "\u042B",
    "ycy": "\u044B",
    "yen": "\u00A5",
    "Yfr": "\uD835\uDD1C",
    "yfr": "\uD835\uDD36",
    "YIcy": "\u0407",
    "yicy": "\u0457",
    "Yopf": "\uD835\uDD50",
    "yopf": "\uD835\uDD6A",
    "Yscr": "\uD835\uDCB4",
    "yscr": "\uD835\uDCCE",
    "YUcy": "\u042E",
    "yucy": "\u044E",
    "Yuml": "\u0178",
    "yuml": "\u00FF",
    "Zacute": "\u0179",
    "zacute": "\u017A",
    "Zcaron": "\u017D",
    "zcaron": "\u017E",
    "Zcy": "\u0417",
    "zcy": "\u0437",
    "Zdot": "\u017B",
    "zdot": "\u017C",
    "zeetrf": "\u2128",
    "ZeroWidthSpace": "\u200B",
    "Zeta": "\u0396",
    "zeta": "\u03B6",
    "Zfr": "\u2128",
    "zfr": "\uD835\uDD37",
    "ZHcy": "\u0416",
    "zhcy": "\u0436",
    "zigrarr": "\u21DD",
    "Zopf": "\u2124",
    "zopf": "\uD835\uDD6B",
    "Zscr": "\uD835\uDCB5",
    "zscr": "\uD835\uDCCF",
    "zwj": "\u200D",
    "zwnj": "\u200C"
});
define("file:///home/sdorries/repos/github/he/src/data/decode-map-legacy", [], {
    "Aacute": "\u00C1",
    "aacute": "\u00E1",
    "Acirc": "\u00C2",
    "acirc": "\u00E2",
    "acute": "\u00B4",
    "AElig": "\u00C6",
    "aelig": "\u00E6",
    "Agrave": "\u00C0",
    "agrave": "\u00E0",
    "AMP": "&",
    "amp": "&",
    "Aring": "\u00C5",
    "aring": "\u00E5",
    "Atilde": "\u00C3",
    "atilde": "\u00E3",
    "Auml": "\u00C4",
    "auml": "\u00E4",
    "brvbar": "\u00A6",
    "Ccedil": "\u00C7",
    "ccedil": "\u00E7",
    "cedil": "\u00B8",
    "cent": "\u00A2",
    "COPY": "\u00A9",
    "copy": "\u00A9",
    "curren": "\u00A4",
    "deg": "\u00B0",
    "divide": "\u00F7",
    "Eacute": "\u00C9",
    "eacute": "\u00E9",
    "Ecirc": "\u00CA",
    "ecirc": "\u00EA",
    "Egrave": "\u00C8",
    "egrave": "\u00E8",
    "ETH": "\u00D0",
    "eth": "\u00F0",
    "Euml": "\u00CB",
    "euml": "\u00EB",
    "frac12": "\u00BD",
    "frac14": "\u00BC",
    "frac34": "\u00BE",
    "GT": ">",
    "gt": ">",
    "Iacute": "\u00CD",
    "iacute": "\u00ED",
    "Icirc": "\u00CE",
    "icirc": "\u00EE",
    "iexcl": "\u00A1",
    "Igrave": "\u00CC",
    "igrave": "\u00EC",
    "iquest": "\u00BF",
    "Iuml": "\u00CF",
    "iuml": "\u00EF",
    "laquo": "\u00AB",
    "LT": "<",
    "lt": "<",
    "macr": "\u00AF",
    "micro": "\u00B5",
    "middot": "\u00B7",
    "nbsp": "\u00A0",
    "not": "\u00AC",
    "Ntilde": "\u00D1",
    "ntilde": "\u00F1",
    "Oacute": "\u00D3",
    "oacute": "\u00F3",
    "Ocirc": "\u00D4",
    "ocirc": "\u00F4",
    "Ograve": "\u00D2",
    "ograve": "\u00F2",
    "ordf": "\u00AA",
    "ordm": "\u00BA",
    "Oslash": "\u00D8",
    "oslash": "\u00F8",
    "Otilde": "\u00D5",
    "otilde": "\u00F5",
    "Ouml": "\u00D6",
    "ouml": "\u00F6",
    "para": "\u00B6",
    "plusmn": "\u00B1",
    "pound": "\u00A3",
    "QUOT": "\"",
    "quot": "\"",
    "raquo": "\u00BB",
    "REG": "\u00AE",
    "reg": "\u00AE",
    "sect": "\u00A7",
    "shy": "\u00AD",
    "sup1": "\u00B9",
    "sup2": "\u00B2",
    "sup3": "\u00B3",
    "szlig": "\u00DF",
    "THORN": "\u00DE",
    "thorn": "\u00FE",
    "times": "\u00D7",
    "Uacute": "\u00DA",
    "uacute": "\u00FA",
    "Ucirc": "\u00DB",
    "ucirc": "\u00FB",
    "Ugrave": "\u00D9",
    "ugrave": "\u00F9",
    "uml": "\u00A8",
    "Uuml": "\u00DC",
    "uuml": "\u00FC",
    "Yacute": "\u00DD",
    "yacute": "\u00FD",
    "yen": "\u00A5",
    "yuml": "\u00FF"
});
define("file:///home/sdorries/repos/github/he/src/data/decode-map-overrides", [], {
    "0": "\uFFFD",
    "128": "\u20AC",
    "130": "\u201A",
    "131": "\u0192",
    "132": "\u201E",
    "133": "\u2026",
    "134": "\u2020",
    "135": "\u2021",
    "136": "\u02C6",
    "137": "\u2030",
    "138": "\u0160",
    "139": "\u2039",
    "140": "\u0152",
    "142": "\u017D",
    "145": "\u2018",
    "146": "\u2019",
    "147": "\u201C",
    "148": "\u201D",
    "149": "\u2022",
    "150": "\u2013",
    "151": "\u2014",
    "152": "\u02DC",
    "153": "\u2122",
    "154": "\u0161",
    "155": "\u203A",
    "156": "\u0153",
    "158": "\u017E",
    "159": "\u0178"
});
define("file:///home/sdorries/repos/github/he/src/data/encode-map", [], {
    "\t": "Tab",
    "\n": "NewLine",
    "!": "excl",
    "\"": "quot",
    "#": "num",
    "$": "dollar",
    "%": "percnt",
    "&": "amp",
    "'": "apos",
    "(": "lpar",
    ")": "rpar",
    "*": "ast",
    "+": "plus",
    ",": "comma",
    ".": "period",
    "/": "sol",
    ":": "colon",
    ";": "semi",
    "<": "lt",
    "<\u20D2": "nvlt",
    "=": "equals",
    "=\u20E5": "bne",
    ">": "gt",
    ">\u20D2": "nvgt",
    "?": "quest",
    "@": "commat",
    "[": "lsqb",
    "\\": "bsol",
    "]": "rsqb",
    "^": "Hat",
    "_": "lowbar",
    "`": "grave",
    "fj": "fjlig",
    "\u0130": "Idot",
    "{": "lcub",
    "|": "vert",
    "}": "rcub",
    "\u00A0": "nbsp",
    "\u00A1": "iexcl",
    "\u00A2": "cent",
    "\u00A3": "pound",
    "\u00A4": "curren",
    "\u00A5": "yen",
    "\u00A6": "brvbar",
    "\u00A7": "sect",
    "\u00A8": "die",
    "\u00A9": "copy",
    "\u00AA": "ordf",
    "\u00AB": "laquo",
    "\u00AC": "not",
    "\u00AD": "shy",
    "\u00AE": "reg",
    "\u00AF": "macr",
    "\u00B0": "deg",
    "\u00B1": "pm",
    "\u00B2": "sup2",
    "\u00B3": "sup3",
    "\u00B4": "acute",
    "\u00B5": "micro",
    "\u00B6": "para",
    "\u00B7": "middot",
    "\u00B8": "cedil",
    "\u00B9": "sup1",
    "\u00BA": "ordm",
    "\u00BB": "raquo",
    "\u00BC": "frac14",
    "\u00BD": "half",
    "\u00BE": "frac34",
    "\u00BF": "iquest",
    "\u00D7": "times",
    "\u00DF": "szlig",
    "\u00C0": "Agrave",
    "\u00E0": "agrave",
    "\u00C1": "Aacute",
    "\u00E1": "aacute",
    "\u00C2": "Acirc",
    "\u00E2": "acirc",
    "\u00C3": "Atilde",
    "\u00E3": "atilde",
    "\u00C4": "Auml",
    "\u00E4": "auml",
    "\u00C5": "angst",
    "\u00E5": "aring",
    "\u00C6": "AElig",
    "\u00E6": "aelig",
    "\u00C7": "Ccedil",
    "\u00E7": "ccedil",
    "\u00C8": "Egrave",
    "\u00E8": "egrave",
    "\u00C9": "Eacute",
    "\u00E9": "eacute",
    "\u00CA": "Ecirc",
    "\u00EA": "ecirc",
    "\u00CB": "Euml",
    "\u00EB": "euml",
    "\u00CC": "Igrave",
    "\u00EC": "igrave",
    "\u00CD": "Iacute",
    "\u00ED": "iacute",
    "\u00CE": "Icirc",
    "\u00EE": "icirc",
    "\u00CF": "Iuml",
    "\u00EF": "iuml",
    "\u00D0": "ETH",
    "\u00F0": "eth",
    "\u00D1": "Ntilde",
    "\u00F1": "ntilde",
    "\u00D2": "Ograve",
    "\u00F2": "ograve",
    "\u00D3": "Oacute",
    "\u00F3": "oacute",
    "\u00D4": "Ocirc",
    "\u00F4": "ocirc",
    "\u00D5": "Otilde",
    "\u00F5": "otilde",
    "\u00D6": "Ouml",
    "\u00F6": "ouml",
    "\u00F7": "div",
    "\u00D8": "Oslash",
    "\u00F8": "oslash",
    "\u00D9": "Ugrave",
    "\u00F9": "ugrave",
    "\u00DA": "Uacute",
    "\u00FA": "uacute",
    "\u00DB": "Ucirc",
    "\u00FB": "ucirc",
    "\u00DC": "Uuml",
    "\u00FC": "uuml",
    "\u00DD": "Yacute",
    "\u00FD": "yacute",
    "\u00DE": "THORN",
    "\u00FE": "thorn",
    "\u0178": "Yuml",
    "\u00FF": "yuml",
    "\u0100": "Amacr",
    "\u0101": "amacr",
    "\u0102": "Abreve",
    "\u0103": "abreve",
    "\u0104": "Aogon",
    "\u0105": "aogon",
    "\u0106": "Cacute",
    "\u0107": "cacute",
    "\u0108": "Ccirc",
    "\u0109": "ccirc",
    "\u010A": "Cdot",
    "\u010B": "cdot",
    "\u010C": "Ccaron",
    "\u010D": "ccaron",
    "\u010E": "Dcaron",
    "\u010F": "dcaron",
    "\u0110": "Dstrok",
    "\u0111": "dstrok",
    "\u0112": "Emacr",
    "\u0113": "emacr",
    "\u0116": "Edot",
    "\u0117": "edot",
    "\u0118": "Eogon",
    "\u0119": "eogon",
    "\u011A": "Ecaron",
    "\u011B": "ecaron",
    "\u011C": "Gcirc",
    "\u011D": "gcirc",
    "\u011E": "Gbreve",
    "\u011F": "gbreve",
    "\u0120": "Gdot",
    "\u0121": "gdot",
    "\u0122": "Gcedil",
    "\u0124": "Hcirc",
    "\u0125": "hcirc",
    "\u0126": "Hstrok",
    "\u0127": "hstrok",
    "\u0128": "Itilde",
    "\u0129": "itilde",
    "\u012A": "Imacr",
    "\u012B": "imacr",
    "\u012E": "Iogon",
    "\u012F": "iogon",
    "\u0131": "imath",
    "\u0132": "IJlig",
    "\u0133": "ijlig",
    "\u0134": "Jcirc",
    "\u0135": "jcirc",
    "\u0136": "Kcedil",
    "\u0137": "kcedil",
    "\u0138": "kgreen",
    "\u0139": "Lacute",
    "\u013A": "lacute",
    "\u013B": "Lcedil",
    "\u013C": "lcedil",
    "\u013D": "Lcaron",
    "\u013E": "lcaron",
    "\u013F": "Lmidot",
    "\u0140": "lmidot",
    "\u0141": "Lstrok",
    "\u0142": "lstrok",
    "\u0143": "Nacute",
    "\u0144": "nacute",
    "\u0145": "Ncedil",
    "\u0146": "ncedil",
    "\u0147": "Ncaron",
    "\u0148": "ncaron",
    "\u0149": "napos",
    "\u014A": "ENG",
    "\u014B": "eng",
    "\u014C": "Omacr",
    "\u014D": "omacr",
    "\u0150": "Odblac",
    "\u0151": "odblac",
    "\u0152": "OElig",
    "\u0153": "oelig",
    "\u0154": "Racute",
    "\u0155": "racute",
    "\u0156": "Rcedil",
    "\u0157": "rcedil",
    "\u0158": "Rcaron",
    "\u0159": "rcaron",
    "\u015A": "Sacute",
    "\u015B": "sacute",
    "\u015C": "Scirc",
    "\u015D": "scirc",
    "\u015E": "Scedil",
    "\u015F": "scedil",
    "\u0160": "Scaron",
    "\u0161": "scaron",
    "\u0162": "Tcedil",
    "\u0163": "tcedil",
    "\u0164": "Tcaron",
    "\u0165": "tcaron",
    "\u0166": "Tstrok",
    "\u0167": "tstrok",
    "\u0168": "Utilde",
    "\u0169": "utilde",
    "\u016A": "Umacr",
    "\u016B": "umacr",
    "\u016C": "Ubreve",
    "\u016D": "ubreve",
    "\u016E": "Uring",
    "\u016F": "uring",
    "\u0170": "Udblac",
    "\u0171": "udblac",
    "\u0172": "Uogon",
    "\u0173": "uogon",
    "\u0174": "Wcirc",
    "\u0175": "wcirc",
    "\u0176": "Ycirc",
    "\u0177": "ycirc",
    "\u0179": "Zacute",
    "\u017A": "zacute",
    "\u017B": "Zdot",
    "\u017C": "zdot",
    "\u017D": "Zcaron",
    "\u017E": "zcaron",
    "\u0192": "fnof",
    "\u01B5": "imped",
    "\u01F5": "gacute",
    "\u0237": "jmath",
    "\u02C6": "circ",
    "\u02C7": "caron",
    "\u02D8": "breve",
    "\u02D9": "dot",
    "\u02DA": "ring",
    "\u02DB": "ogon",
    "\u02DC": "tilde",
    "\u02DD": "dblac",
    "\u0311": "DownBreve",
    "\u0391": "Alpha",
    "\u03B1": "alpha",
    "\u0392": "Beta",
    "\u03B2": "beta",
    "\u0393": "Gamma",
    "\u03B3": "gamma",
    "\u0394": "Delta",
    "\u03B4": "delta",
    "\u0395": "Epsilon",
    "\u03B5": "epsi",
    "\u0396": "Zeta",
    "\u03B6": "zeta",
    "\u0397": "Eta",
    "\u03B7": "eta",
    "\u0398": "Theta",
    "\u03B8": "theta",
    "\u0399": "Iota",
    "\u03B9": "iota",
    "\u039A": "Kappa",
    "\u03BA": "kappa",
    "\u039B": "Lambda",
    "\u03BB": "lambda",
    "\u039C": "Mu",
    "\u03BC": "mu",
    "\u039D": "Nu",
    "\u03BD": "nu",
    "\u039E": "Xi",
    "\u03BE": "xi",
    "\u039F": "Omicron",
    "\u03BF": "omicron",
    "\u03A0": "Pi",
    "\u03C0": "pi",
    "\u03A1": "Rho",
    "\u03C1": "rho",
    "\u03A3": "Sigma",
    "\u03C2": "sigmaf",
    "\u03C3": "sigma",
    "\u03A4": "Tau",
    "\u03C4": "tau",
    "\u03A5": "Upsilon",
    "\u03C5": "upsi",
    "\u03A6": "Phi",
    "\u03C6": "phi",
    "\u03A7": "Chi",
    "\u03C7": "chi",
    "\u03A8": "Psi",
    "\u03C8": "psi",
    "\u03A9": "ohm",
    "\u03C9": "omega",
    "\u03D1": "thetav",
    "\u03D2": "Upsi",
    "\u03D5": "phiv",
    "\u03D6": "piv",
    "\u03DC": "Gammad",
    "\u03DD": "gammad",
    "\u03F0": "kappav",
    "\u03F1": "rhov",
    "\u03F5": "epsiv",
    "\u03F6": "bepsi",
    "\u0410": "Acy",
    "\u0430": "acy",
    "\u0411": "Bcy",
    "\u0431": "bcy",
    "\u0412": "Vcy",
    "\u0432": "vcy",
    "\u0413": "Gcy",
    "\u0433": "gcy",
    "\u0414": "Dcy",
    "\u0434": "dcy",
    "\u0415": "IEcy",
    "\u0435": "iecy",
    "\u0416": "ZHcy",
    "\u0436": "zhcy",
    "\u0417": "Zcy",
    "\u0437": "zcy",
    "\u0418": "Icy",
    "\u0438": "icy",
    "\u0419": "Jcy",
    "\u0439": "jcy",
    "\u041A": "Kcy",
    "\u043A": "kcy",
    "\u041B": "Lcy",
    "\u043B": "lcy",
    "\u041C": "Mcy",
    "\u043C": "mcy",
    "\u041D": "Ncy",
    "\u043D": "ncy",
    "\u041E": "Ocy",
    "\u043E": "ocy",
    "\u041F": "Pcy",
    "\u043F": "pcy",
    "\u0420": "Rcy",
    "\u0440": "rcy",
    "\u0421": "Scy",
    "\u0441": "scy",
    "\u0422": "Tcy",
    "\u0442": "tcy",
    "\u0423": "Ucy",
    "\u0443": "ucy",
    "\u0424": "Fcy",
    "\u0444": "fcy",
    "\u0425": "KHcy",
    "\u0445": "khcy",
    "\u0426": "TScy",
    "\u0446": "tscy",
    "\u0427": "CHcy",
    "\u0447": "chcy",
    "\u0428": "SHcy",
    "\u0448": "shcy",
    "\u0429": "SHCHcy",
    "\u0449": "shchcy",
    "\u042A": "HARDcy",
    "\u044A": "hardcy",
    "\u042B": "Ycy",
    "\u044B": "ycy",
    "\u042C": "SOFTcy",
    "\u044C": "softcy",
    "\u042D": "Ecy",
    "\u044D": "ecy",
    "\u042E": "YUcy",
    "\u044E": "yucy",
    "\u042F": "YAcy",
    "\u044F": "yacy",
    "\u0401": "IOcy",
    "\u0451": "iocy",
    "\u0402": "DJcy",
    "\u0452": "djcy",
    "\u0403": "GJcy",
    "\u0453": "gjcy",
    "\u0404": "Jukcy",
    "\u0454": "jukcy",
    "\u0405": "DScy",
    "\u0455": "dscy",
    "\u0406": "Iukcy",
    "\u0456": "iukcy",
    "\u0407": "YIcy",
    "\u0457": "yicy",
    "\u0408": "Jsercy",
    "\u0458": "jsercy",
    "\u0409": "LJcy",
    "\u0459": "ljcy",
    "\u040A": "NJcy",
    "\u045A": "njcy",
    "\u040B": "TSHcy",
    "\u045B": "tshcy",
    "\u040C": "KJcy",
    "\u045C": "kjcy",
    "\u040E": "Ubrcy",
    "\u045E": "ubrcy",
    "\u040F": "DZcy",
    "\u045F": "dzcy",
    "\u2002": "ensp",
    "\u2003": "emsp",
    "\u2004": "emsp13",
    "\u2005": "emsp14",
    "\u2007": "numsp",
    "\u2008": "puncsp",
    "\u2009": "thinsp",
    "\u200A": "hairsp",
    "\u200B": "ZeroWidthSpace",
    "\u200C": "zwnj",
    "\u200D": "zwj",
    "\u200E": "lrm",
    "\u200F": "rlm",
    "\u2010": "dash",
    "\u2013": "ndash",
    "\u2014": "mdash",
    "\u2015": "horbar",
    "\u2016": "Vert",
    "\u2018": "lsquo",
    "\u2019": "rsquo",
    "\u201A": "sbquo",
    "\u201C": "ldquo",
    "\u201D": "rdquo",
    "\u201E": "bdquo",
    "\u2020": "dagger",
    "\u2021": "Dagger",
    "\u2022": "bull",
    "\u2025": "nldr",
    "\u2026": "mldr",
    "\u2030": "permil",
    "\u2031": "pertenk",
    "\u2032": "prime",
    "\u2033": "Prime",
    "\u2034": "tprime",
    "\u2035": "bprime",
    "\u2039": "lsaquo",
    "\u203A": "rsaquo",
    "\u203E": "oline",
    "\u2041": "caret",
    "\u2043": "hybull",
    "\u2044": "frasl",
    "\u204F": "bsemi",
    "\u2057": "qprime",
    "\u205F": "MediumSpace",
    "\u205F\u200A": "ThickSpace",
    "\u2060": "NoBreak",
    "\u2061": "af",
    "\u2062": "it",
    "\u2063": "ic",
    "\u20AC": "euro",
    "\u20DB": "tdot",
    "\u20DC": "DotDot",
    "\u2102": "Copf",
    "\u2105": "incare",
    "\u210A": "gscr",
    "\u210B": "Hscr",
    "\u210C": "Hfr",
    "\u210D": "Hopf",
    "\u210E": "planckh",
    "\u210F": "hbar",
    "\u2110": "Iscr",
    "\u2111": "Im",
    "\u2112": "Lscr",
    "\u2113": "ell",
    "\u2115": "Nopf",
    "\u2116": "numero",
    "\u2117": "copysr",
    "\u2118": "wp",
    "\u2119": "Popf",
    "\u211A": "Qopf",
    "\u211B": "Rscr",
    "\u211C": "Re",
    "\u211D": "Ropf",
    "\u211E": "rx",
    "\u2122": "trade",
    "\u2124": "Zopf",
    "\u2127": "mho",
    "\u2128": "Zfr",
    "\u2129": "iiota",
    "\u212C": "Bscr",
    "\u212D": "Cfr",
    "\u212F": "escr",
    "\u2130": "Escr",
    "\u2131": "Fscr",
    "\u2133": "Mscr",
    "\u2134": "oscr",
    "\u2135": "aleph",
    "\u2136": "beth",
    "\u2137": "gimel",
    "\u2138": "daleth",
    "\u2145": "DD",
    "\u2146": "dd",
    "\u2147": "ee",
    "\u2148": "ii",
    "\u2153": "frac13",
    "\u2154": "frac23",
    "\u2155": "frac15",
    "\u2156": "frac25",
    "\u2157": "frac35",
    "\u2158": "frac45",
    "\u2159": "frac16",
    "\u215A": "frac56",
    "\u215B": "frac18",
    "\u215C": "frac38",
    "\u215D": "frac58",
    "\u215E": "frac78",
    "\u2190": "larr",
    "\u2191": "uarr",
    "\u2192": "rarr",
    "\u2193": "darr",
    "\u2194": "harr",
    "\u2195": "varr",
    "\u2196": "nwarr",
    "\u2197": "nearr",
    "\u2198": "searr",
    "\u2199": "swarr",
    "\u219A": "nlarr",
    "\u219B": "nrarr",
    "\u219D": "rarrw",
    "\u219D\u0338": "nrarrw",
    "\u219E": "Larr",
    "\u219F": "Uarr",
    "\u21A0": "Rarr",
    "\u21A1": "Darr",
    "\u21A2": "larrtl",
    "\u21A3": "rarrtl",
    "\u21A4": "mapstoleft",
    "\u21A5": "mapstoup",
    "\u21A6": "map",
    "\u21A7": "mapstodown",
    "\u21A9": "larrhk",
    "\u21AA": "rarrhk",
    "\u21AB": "larrlp",
    "\u21AC": "rarrlp",
    "\u21AD": "harrw",
    "\u21AE": "nharr",
    "\u21B0": "lsh",
    "\u21B1": "rsh",
    "\u21B2": "ldsh",
    "\u21B3": "rdsh",
    "\u21B5": "crarr",
    "\u21B6": "cularr",
    "\u21B7": "curarr",
    "\u21BA": "olarr",
    "\u21BB": "orarr",
    "\u21BC": "lharu",
    "\u21BD": "lhard",
    "\u21BE": "uharr",
    "\u21BF": "uharl",
    "\u21C0": "rharu",
    "\u21C1": "rhard",
    "\u21C2": "dharr",
    "\u21C3": "dharl",
    "\u21C4": "rlarr",
    "\u21C5": "udarr",
    "\u21C6": "lrarr",
    "\u21C7": "llarr",
    "\u21C8": "uuarr",
    "\u21C9": "rrarr",
    "\u21CA": "ddarr",
    "\u21CB": "lrhar",
    "\u21CC": "rlhar",
    "\u21CD": "nlArr",
    "\u21CE": "nhArr",
    "\u21CF": "nrArr",
    "\u21D0": "lArr",
    "\u21D1": "uArr",
    "\u21D2": "rArr",
    "\u21D3": "dArr",
    "\u21D4": "iff",
    "\u21D5": "vArr",
    "\u21D6": "nwArr",
    "\u21D7": "neArr",
    "\u21D8": "seArr",
    "\u21D9": "swArr",
    "\u21DA": "lAarr",
    "\u21DB": "rAarr",
    "\u21DD": "zigrarr",
    "\u21E4": "larrb",
    "\u21E5": "rarrb",
    "\u21F5": "duarr",
    "\u21FD": "loarr",
    "\u21FE": "roarr",
    "\u21FF": "hoarr",
    "\u2200": "forall",
    "\u2201": "comp",
    "\u2202": "part",
    "\u2202\u0338": "npart",
    "\u2203": "exist",
    "\u2204": "nexist",
    "\u2205": "empty",
    "\u2207": "Del",
    "\u2208": "in",
    "\u2209": "notin",
    "\u220B": "ni",
    "\u220C": "notni",
    "\u220F": "prod",
    "\u2210": "coprod",
    "\u2211": "sum",
    "\u2212": "minus",
    "\u2213": "mp",
    "\u2214": "plusdo",
    "\u2216": "setmn",
    "\u2217": "lowast",
    "\u2218": "compfn",
    "\u221A": "Sqrt",
    "\u221D": "prop",
    "\u221E": "infin",
    "\u221F": "angrt",
    "\u2220": "ang",
    "\u2220\u20D2": "nang",
    "\u2221": "angmsd",
    "\u2222": "angsph",
    "\u2223": "mid",
    "\u2224": "nmid",
    "\u2225": "par",
    "\u2226": "npar",
    "\u2227": "and",
    "\u2228": "or",
    "\u2229": "cap",
    "\u2229\uFE00": "caps",
    "\u222A": "cup",
    "\u222A\uFE00": "cups",
    "\u222B": "int",
    "\u222C": "Int",
    "\u222D": "tint",
    "\u222E": "oint",
    "\u222F": "Conint",
    "\u2230": "Cconint",
    "\u2231": "cwint",
    "\u2232": "cwconint",
    "\u2233": "awconint",
    "\u2234": "there4",
    "\u2235": "becaus",
    "\u2236": "ratio",
    "\u2237": "Colon",
    "\u2238": "minusd",
    "\u223A": "mDDot",
    "\u223B": "homtht",
    "\u223C": "sim",
    "\u223C\u20D2": "nvsim",
    "\u223D": "bsim",
    "\u223D\u0331": "race",
    "\u223E": "ac",
    "\u223E\u0333": "acE",
    "\u223F": "acd",
    "\u2240": "wr",
    "\u2241": "nsim",
    "\u2242": "esim",
    "\u2242\u0338": "nesim",
    "\u2243": "sime",
    "\u2244": "nsime",
    "\u2245": "cong",
    "\u2246": "simne",
    "\u2247": "ncong",
    "\u2248": "ap",
    "\u2249": "nap",
    "\u224A": "ape",
    "\u224B": "apid",
    "\u224B\u0338": "napid",
    "\u224C": "bcong",
    "\u224D": "CupCap",
    "\u224D\u20D2": "nvap",
    "\u224E": "bump",
    "\u224E\u0338": "nbump",
    "\u224F": "bumpe",
    "\u224F\u0338": "nbumpe",
    "\u2250": "doteq",
    "\u2250\u0338": "nedot",
    "\u2251": "eDot",
    "\u2252": "efDot",
    "\u2253": "erDot",
    "\u2254": "colone",
    "\u2255": "ecolon",
    "\u2256": "ecir",
    "\u2257": "cire",
    "\u2259": "wedgeq",
    "\u225A": "veeeq",
    "\u225C": "trie",
    "\u225F": "equest",
    "\u2260": "ne",
    "\u2261": "equiv",
    "\u2261\u20E5": "bnequiv",
    "\u2262": "nequiv",
    "\u2264": "le",
    "\u2264\u20D2": "nvle",
    "\u2265": "ge",
    "\u2265\u20D2": "nvge",
    "\u2266": "lE",
    "\u2266\u0338": "nlE",
    "\u2267": "gE",
    "\u2267\u0338": "ngE",
    "\u2268": "lnE",
    "\u2268\uFE00": "lvnE",
    "\u2269": "gnE",
    "\u2269\uFE00": "gvnE",
    "\u226A": "ll",
    "\u226A\u0338": "nLtv",
    "\u226A\u20D2": "nLt",
    "\u226B": "gg",
    "\u226B\u0338": "nGtv",
    "\u226B\u20D2": "nGt",
    "\u226C": "twixt",
    "\u226D": "NotCupCap",
    "\u226E": "nlt",
    "\u226F": "ngt",
    "\u2270": "nle",
    "\u2271": "nge",
    "\u2272": "lsim",
    "\u2273": "gsim",
    "\u2274": "nlsim",
    "\u2275": "ngsim",
    "\u2276": "lg",
    "\u2277": "gl",
    "\u2278": "ntlg",
    "\u2279": "ntgl",
    "\u227A": "pr",
    "\u227B": "sc",
    "\u227C": "prcue",
    "\u227D": "sccue",
    "\u227E": "prsim",
    "\u227F": "scsim",
    "\u227F\u0338": "NotSucceedsTilde",
    "\u2280": "npr",
    "\u2281": "nsc",
    "\u2282": "sub",
    "\u2282\u20D2": "vnsub",
    "\u2283": "sup",
    "\u2283\u20D2": "vnsup",
    "\u2284": "nsub",
    "\u2285": "nsup",
    "\u2286": "sube",
    "\u2287": "supe",
    "\u2288": "nsube",
    "\u2289": "nsupe",
    "\u228A": "subne",
    "\u228A\uFE00": "vsubne",
    "\u228B": "supne",
    "\u228B\uFE00": "vsupne",
    "\u228D": "cupdot",
    "\u228E": "uplus",
    "\u228F": "sqsub",
    "\u228F\u0338": "NotSquareSubset",
    "\u2290": "sqsup",
    "\u2290\u0338": "NotSquareSuperset",
    "\u2291": "sqsube",
    "\u2292": "sqsupe",
    "\u2293": "sqcap",
    "\u2293\uFE00": "sqcaps",
    "\u2294": "sqcup",
    "\u2294\uFE00": "sqcups",
    "\u2295": "oplus",
    "\u2296": "ominus",
    "\u2297": "otimes",
    "\u2298": "osol",
    "\u2299": "odot",
    "\u229A": "ocir",
    "\u229B": "oast",
    "\u229D": "odash",
    "\u229E": "plusb",
    "\u229F": "minusb",
    "\u22A0": "timesb",
    "\u22A1": "sdotb",
    "\u22A2": "vdash",
    "\u22A3": "dashv",
    "\u22A4": "top",
    "\u22A5": "bot",
    "\u22A7": "models",
    "\u22A8": "vDash",
    "\u22A9": "Vdash",
    "\u22AA": "Vvdash",
    "\u22AB": "VDash",
    "\u22AC": "nvdash",
    "\u22AD": "nvDash",
    "\u22AE": "nVdash",
    "\u22AF": "nVDash",
    "\u22B0": "prurel",
    "\u22B2": "vltri",
    "\u22B3": "vrtri",
    "\u22B4": "ltrie",
    "\u22B4\u20D2": "nvltrie",
    "\u22B5": "rtrie",
    "\u22B5\u20D2": "nvrtrie",
    "\u22B6": "origof",
    "\u22B7": "imof",
    "\u22B8": "mumap",
    "\u22B9": "hercon",
    "\u22BA": "intcal",
    "\u22BB": "veebar",
    "\u22BD": "barvee",
    "\u22BE": "angrtvb",
    "\u22BF": "lrtri",
    "\u22C0": "Wedge",
    "\u22C1": "Vee",
    "\u22C2": "xcap",
    "\u22C3": "xcup",
    "\u22C4": "diam",
    "\u22C5": "sdot",
    "\u22C6": "Star",
    "\u22C7": "divonx",
    "\u22C8": "bowtie",
    "\u22C9": "ltimes",
    "\u22CA": "rtimes",
    "\u22CB": "lthree",
    "\u22CC": "rthree",
    "\u22CD": "bsime",
    "\u22CE": "cuvee",
    "\u22CF": "cuwed",
    "\u22D0": "Sub",
    "\u22D1": "Sup",
    "\u22D2": "Cap",
    "\u22D3": "Cup",
    "\u22D4": "fork",
    "\u22D5": "epar",
    "\u22D6": "ltdot",
    "\u22D7": "gtdot",
    "\u22D8": "Ll",
    "\u22D8\u0338": "nLl",
    "\u22D9": "Gg",
    "\u22D9\u0338": "nGg",
    "\u22DA": "leg",
    "\u22DA\uFE00": "lesg",
    "\u22DB": "gel",
    "\u22DB\uFE00": "gesl",
    "\u22DE": "cuepr",
    "\u22DF": "cuesc",
    "\u22E0": "nprcue",
    "\u22E1": "nsccue",
    "\u22E2": "nsqsube",
    "\u22E3": "nsqsupe",
    "\u22E6": "lnsim",
    "\u22E7": "gnsim",
    "\u22E8": "prnsim",
    "\u22E9": "scnsim",
    "\u22EA": "nltri",
    "\u22EB": "nrtri",
    "\u22EC": "nltrie",
    "\u22ED": "nrtrie",
    "\u22EE": "vellip",
    "\u22EF": "ctdot",
    "\u22F0": "utdot",
    "\u22F1": "dtdot",
    "\u22F2": "disin",
    "\u22F3": "isinsv",
    "\u22F4": "isins",
    "\u22F5": "isindot",
    "\u22F5\u0338": "notindot",
    "\u22F6": "notinvc",
    "\u22F7": "notinvb",
    "\u22F9": "isinE",
    "\u22F9\u0338": "notinE",
    "\u22FA": "nisd",
    "\u22FB": "xnis",
    "\u22FC": "nis",
    "\u22FD": "notnivc",
    "\u22FE": "notnivb",
    "\u2305": "barwed",
    "\u2306": "Barwed",
    "\u2308": "lceil",
    "\u2309": "rceil",
    "\u230A": "lfloor",
    "\u230B": "rfloor",
    "\u230C": "drcrop",
    "\u230D": "dlcrop",
    "\u230E": "urcrop",
    "\u230F": "ulcrop",
    "\u2310": "bnot",
    "\u2312": "profline",
    "\u2313": "profsurf",
    "\u2315": "telrec",
    "\u2316": "target",
    "\u231C": "ulcorn",
    "\u231D": "urcorn",
    "\u231E": "dlcorn",
    "\u231F": "drcorn",
    "\u2322": "frown",
    "\u2323": "smile",
    "\u232D": "cylcty",
    "\u232E": "profalar",
    "\u2336": "topbot",
    "\u233D": "ovbar",
    "\u233F": "solbar",
    "\u237C": "angzarr",
    "\u23B0": "lmoust",
    "\u23B1": "rmoust",
    "\u23B4": "tbrk",
    "\u23B5": "bbrk",
    "\u23B6": "bbrktbrk",
    "\u23DC": "OverParenthesis",
    "\u23DD": "UnderParenthesis",
    "\u23DE": "OverBrace",
    "\u23DF": "UnderBrace",
    "\u23E2": "trpezium",
    "\u23E7": "elinters",
    "\u2423": "blank",
    "\u24C8": "oS",
    "\u2500": "boxh",
    "\u2502": "boxv",
    "\u250C": "boxdr",
    "\u2510": "boxdl",
    "\u2514": "boxur",
    "\u2518": "boxul",
    "\u251C": "boxvr",
    "\u2524": "boxvl",
    "\u252C": "boxhd",
    "\u2534": "boxhu",
    "\u253C": "boxvh",
    "\u2550": "boxH",
    "\u2551": "boxV",
    "\u2552": "boxdR",
    "\u2553": "boxDr",
    "\u2554": "boxDR",
    "\u2555": "boxdL",
    "\u2556": "boxDl",
    "\u2557": "boxDL",
    "\u2558": "boxuR",
    "\u2559": "boxUr",
    "\u255A": "boxUR",
    "\u255B": "boxuL",
    "\u255C": "boxUl",
    "\u255D": "boxUL",
    "\u255E": "boxvR",
    "\u255F": "boxVr",
    "\u2560": "boxVR",
    "\u2561": "boxvL",
    "\u2562": "boxVl",
    "\u2563": "boxVL",
    "\u2564": "boxHd",
    "\u2565": "boxhD",
    "\u2566": "boxHD",
    "\u2567": "boxHu",
    "\u2568": "boxhU",
    "\u2569": "boxHU",
    "\u256A": "boxvH",
    "\u256B": "boxVh",
    "\u256C": "boxVH",
    "\u2580": "uhblk",
    "\u2584": "lhblk",
    "\u2588": "block",
    "\u2591": "blk14",
    "\u2592": "blk12",
    "\u2593": "blk34",
    "\u25A1": "squ",
    "\u25AA": "squf",
    "\u25AB": "EmptyVerySmallSquare",
    "\u25AD": "rect",
    "\u25AE": "marker",
    "\u25B1": "fltns",
    "\u25B3": "xutri",
    "\u25B4": "utrif",
    "\u25B5": "utri",
    "\u25B8": "rtrif",
    "\u25B9": "rtri",
    "\u25BD": "xdtri",
    "\u25BE": "dtrif",
    "\u25BF": "dtri",
    "\u25C2": "ltrif",
    "\u25C3": "ltri",
    "\u25CA": "loz",
    "\u25CB": "cir",
    "\u25EC": "tridot",
    "\u25EF": "xcirc",
    "\u25F8": "ultri",
    "\u25F9": "urtri",
    "\u25FA": "lltri",
    "\u25FB": "EmptySmallSquare",
    "\u25FC": "FilledSmallSquare",
    "\u2605": "starf",
    "\u2606": "star",
    "\u260E": "phone",
    "\u2640": "female",
    "\u2642": "male",
    "\u2660": "spades",
    "\u2663": "clubs",
    "\u2665": "hearts",
    "\u2666": "diams",
    "\u266A": "sung",
    "\u266D": "flat",
    "\u266E": "natur",
    "\u266F": "sharp",
    "\u2713": "check",
    "\u2717": "cross",
    "\u2720": "malt",
    "\u2736": "sext",
    "\u2758": "VerticalSeparator",
    "\u2772": "lbbrk",
    "\u2773": "rbbrk",
    "\u27C8": "bsolhsub",
    "\u27C9": "suphsol",
    "\u27E6": "lobrk",
    "\u27E7": "robrk",
    "\u27E8": "lang",
    "\u27E9": "rang",
    "\u27EA": "Lang",
    "\u27EB": "Rang",
    "\u27EC": "loang",
    "\u27ED": "roang",
    "\u27F5": "xlarr",
    "\u27F6": "xrarr",
    "\u27F7": "xharr",
    "\u27F8": "xlArr",
    "\u27F9": "xrArr",
    "\u27FA": "xhArr",
    "\u27FC": "xmap",
    "\u27FF": "dzigrarr",
    "\u2902": "nvlArr",
    "\u2903": "nvrArr",
    "\u2904": "nvHarr",
    "\u2905": "Map",
    "\u290C": "lbarr",
    "\u290D": "rbarr",
    "\u290E": "lBarr",
    "\u290F": "rBarr",
    "\u2910": "RBarr",
    "\u2911": "DDotrahd",
    "\u2912": "UpArrowBar",
    "\u2913": "DownArrowBar",
    "\u2916": "Rarrtl",
    "\u2919": "latail",
    "\u291A": "ratail",
    "\u291B": "lAtail",
    "\u291C": "rAtail",
    "\u291D": "larrfs",
    "\u291E": "rarrfs",
    "\u291F": "larrbfs",
    "\u2920": "rarrbfs",
    "\u2923": "nwarhk",
    "\u2924": "nearhk",
    "\u2925": "searhk",
    "\u2926": "swarhk",
    "\u2927": "nwnear",
    "\u2928": "toea",
    "\u2929": "tosa",
    "\u292A": "swnwar",
    "\u2933": "rarrc",
    "\u2933\u0338": "nrarrc",
    "\u2935": "cudarrr",
    "\u2936": "ldca",
    "\u2937": "rdca",
    "\u2938": "cudarrl",
    "\u2939": "larrpl",
    "\u293C": "curarrm",
    "\u293D": "cularrp",
    "\u2945": "rarrpl",
    "\u2948": "harrcir",
    "\u2949": "Uarrocir",
    "\u294A": "lurdshar",
    "\u294B": "ldrushar",
    "\u294E": "LeftRightVector",
    "\u294F": "RightUpDownVector",
    "\u2950": "DownLeftRightVector",
    "\u2951": "LeftUpDownVector",
    "\u2952": "LeftVectorBar",
    "\u2953": "RightVectorBar",
    "\u2954": "RightUpVectorBar",
    "\u2955": "RightDownVectorBar",
    "\u2956": "DownLeftVectorBar",
    "\u2957": "DownRightVectorBar",
    "\u2958": "LeftUpVectorBar",
    "\u2959": "LeftDownVectorBar",
    "\u295A": "LeftTeeVector",
    "\u295B": "RightTeeVector",
    "\u295C": "RightUpTeeVector",
    "\u295D": "RightDownTeeVector",
    "\u295E": "DownLeftTeeVector",
    "\u295F": "DownRightTeeVector",
    "\u2960": "LeftUpTeeVector",
    "\u2961": "LeftDownTeeVector",
    "\u2962": "lHar",
    "\u2963": "uHar",
    "\u2964": "rHar",
    "\u2965": "dHar",
    "\u2966": "luruhar",
    "\u2967": "ldrdhar",
    "\u2968": "ruluhar",
    "\u2969": "rdldhar",
    "\u296A": "lharul",
    "\u296B": "llhard",
    "\u296C": "rharul",
    "\u296D": "lrhard",
    "\u296E": "udhar",
    "\u296F": "duhar",
    "\u2970": "RoundImplies",
    "\u2971": "erarr",
    "\u2972": "simrarr",
    "\u2973": "larrsim",
    "\u2974": "rarrsim",
    "\u2975": "rarrap",
    "\u2976": "ltlarr",
    "\u2978": "gtrarr",
    "\u2979": "subrarr",
    "\u297B": "suplarr",
    "\u297C": "lfisht",
    "\u297D": "rfisht",
    "\u297E": "ufisht",
    "\u297F": "dfisht",
    "\u2985": "lopar",
    "\u2986": "ropar",
    "\u298B": "lbrke",
    "\u298C": "rbrke",
    "\u298D": "lbrkslu",
    "\u298E": "rbrksld",
    "\u298F": "lbrksld",
    "\u2990": "rbrkslu",
    "\u2991": "langd",
    "\u2992": "rangd",
    "\u2993": "lparlt",
    "\u2994": "rpargt",
    "\u2995": "gtlPar",
    "\u2996": "ltrPar",
    "\u299A": "vzigzag",
    "\u299C": "vangrt",
    "\u299D": "angrtvbd",
    "\u29A4": "ange",
    "\u29A5": "range",
    "\u29A6": "dwangle",
    "\u29A7": "uwangle",
    "\u29A8": "angmsdaa",
    "\u29A9": "angmsdab",
    "\u29AA": "angmsdac",
    "\u29AB": "angmsdad",
    "\u29AC": "angmsdae",
    "\u29AD": "angmsdaf",
    "\u29AE": "angmsdag",
    "\u29AF": "angmsdah",
    "\u29B0": "bemptyv",
    "\u29B1": "demptyv",
    "\u29B2": "cemptyv",
    "\u29B3": "raemptyv",
    "\u29B4": "laemptyv",
    "\u29B5": "ohbar",
    "\u29B6": "omid",
    "\u29B7": "opar",
    "\u29B9": "operp",
    "\u29BB": "olcross",
    "\u29BC": "odsold",
    "\u29BE": "olcir",
    "\u29BF": "ofcir",
    "\u29C0": "olt",
    "\u29C1": "ogt",
    "\u29C2": "cirscir",
    "\u29C3": "cirE",
    "\u29C4": "solb",
    "\u29C5": "bsolb",
    "\u29C9": "boxbox",
    "\u29CD": "trisb",
    "\u29CE": "rtriltri",
    "\u29CF": "LeftTriangleBar",
    "\u29CF\u0338": "NotLeftTriangleBar",
    "\u29D0": "RightTriangleBar",
    "\u29D0\u0338": "NotRightTriangleBar",
    "\u29DC": "iinfin",
    "\u29DD": "infintie",
    "\u29DE": "nvinfin",
    "\u29E3": "eparsl",
    "\u29E4": "smeparsl",
    "\u29E5": "eqvparsl",
    "\u29EB": "lozf",
    "\u29F4": "RuleDelayed",
    "\u29F6": "dsol",
    "\u2A00": "xodot",
    "\u2A01": "xoplus",
    "\u2A02": "xotime",
    "\u2A04": "xuplus",
    "\u2A06": "xsqcup",
    "\u2A0C": "qint",
    "\u2A0D": "fpartint",
    "\u2A10": "cirfnint",
    "\u2A11": "awint",
    "\u2A12": "rppolint",
    "\u2A13": "scpolint",
    "\u2A14": "npolint",
    "\u2A15": "pointint",
    "\u2A16": "quatint",
    "\u2A17": "intlarhk",
    "\u2A22": "pluscir",
    "\u2A23": "plusacir",
    "\u2A24": "simplus",
    "\u2A25": "plusdu",
    "\u2A26": "plussim",
    "\u2A27": "plustwo",
    "\u2A29": "mcomma",
    "\u2A2A": "minusdu",
    "\u2A2D": "loplus",
    "\u2A2E": "roplus",
    "\u2A2F": "Cross",
    "\u2A30": "timesd",
    "\u2A31": "timesbar",
    "\u2A33": "smashp",
    "\u2A34": "lotimes",
    "\u2A35": "rotimes",
    "\u2A36": "otimesas",
    "\u2A37": "Otimes",
    "\u2A38": "odiv",
    "\u2A39": "triplus",
    "\u2A3A": "triminus",
    "\u2A3B": "tritime",
    "\u2A3C": "iprod",
    "\u2A3F": "amalg",
    "\u2A40": "capdot",
    "\u2A42": "ncup",
    "\u2A43": "ncap",
    "\u2A44": "capand",
    "\u2A45": "cupor",
    "\u2A46": "cupcap",
    "\u2A47": "capcup",
    "\u2A48": "cupbrcap",
    "\u2A49": "capbrcup",
    "\u2A4A": "cupcup",
    "\u2A4B": "capcap",
    "\u2A4C": "ccups",
    "\u2A4D": "ccaps",
    "\u2A50": "ccupssm",
    "\u2A53": "And",
    "\u2A54": "Or",
    "\u2A55": "andand",
    "\u2A56": "oror",
    "\u2A57": "orslope",
    "\u2A58": "andslope",
    "\u2A5A": "andv",
    "\u2A5B": "orv",
    "\u2A5C": "andd",
    "\u2A5D": "ord",
    "\u2A5F": "wedbar",
    "\u2A66": "sdote",
    "\u2A6A": "simdot",
    "\u2A6D": "congdot",
    "\u2A6D\u0338": "ncongdot",
    "\u2A6E": "easter",
    "\u2A6F": "apacir",
    "\u2A70": "apE",
    "\u2A70\u0338": "napE",
    "\u2A71": "eplus",
    "\u2A72": "pluse",
    "\u2A73": "Esim",
    "\u2A74": "Colone",
    "\u2A75": "Equal",
    "\u2A77": "eDDot",
    "\u2A78": "equivDD",
    "\u2A79": "ltcir",
    "\u2A7A": "gtcir",
    "\u2A7B": "ltquest",
    "\u2A7C": "gtquest",
    "\u2A7D": "les",
    "\u2A7D\u0338": "nles",
    "\u2A7E": "ges",
    "\u2A7E\u0338": "nges",
    "\u2A7F": "lesdot",
    "\u2A80": "gesdot",
    "\u2A81": "lesdoto",
    "\u2A82": "gesdoto",
    "\u2A83": "lesdotor",
    "\u2A84": "gesdotol",
    "\u2A85": "lap",
    "\u2A86": "gap",
    "\u2A87": "lne",
    "\u2A88": "gne",
    "\u2A89": "lnap",
    "\u2A8A": "gnap",
    "\u2A8B": "lEg",
    "\u2A8C": "gEl",
    "\u2A8D": "lsime",
    "\u2A8E": "gsime",
    "\u2A8F": "lsimg",
    "\u2A90": "gsiml",
    "\u2A91": "lgE",
    "\u2A92": "glE",
    "\u2A93": "lesges",
    "\u2A94": "gesles",
    "\u2A95": "els",
    "\u2A96": "egs",
    "\u2A97": "elsdot",
    "\u2A98": "egsdot",
    "\u2A99": "el",
    "\u2A9A": "eg",
    "\u2A9D": "siml",
    "\u2A9E": "simg",
    "\u2A9F": "simlE",
    "\u2AA0": "simgE",
    "\u2AA1": "LessLess",
    "\u2AA1\u0338": "NotNestedLessLess",
    "\u2AA2": "GreaterGreater",
    "\u2AA2\u0338": "NotNestedGreaterGreater",
    "\u2AA4": "glj",
    "\u2AA5": "gla",
    "\u2AA6": "ltcc",
    "\u2AA7": "gtcc",
    "\u2AA8": "lescc",
    "\u2AA9": "gescc",
    "\u2AAA": "smt",
    "\u2AAB": "lat",
    "\u2AAC": "smte",
    "\u2AAC\uFE00": "smtes",
    "\u2AAD": "late",
    "\u2AAD\uFE00": "lates",
    "\u2AAE": "bumpE",
    "\u2AAF": "pre",
    "\u2AAF\u0338": "npre",
    "\u2AB0": "sce",
    "\u2AB0\u0338": "nsce",
    "\u2AB3": "prE",
    "\u2AB4": "scE",
    "\u2AB5": "prnE",
    "\u2AB6": "scnE",
    "\u2AB7": "prap",
    "\u2AB8": "scap",
    "\u2AB9": "prnap",
    "\u2ABA": "scnap",
    "\u2ABB": "Pr",
    "\u2ABC": "Sc",
    "\u2ABD": "subdot",
    "\u2ABE": "supdot",
    "\u2ABF": "subplus",
    "\u2AC0": "supplus",
    "\u2AC1": "submult",
    "\u2AC2": "supmult",
    "\u2AC3": "subedot",
    "\u2AC4": "supedot",
    "\u2AC5": "subE",
    "\u2AC5\u0338": "nsubE",
    "\u2AC6": "supE",
    "\u2AC6\u0338": "nsupE",
    "\u2AC7": "subsim",
    "\u2AC8": "supsim",
    "\u2ACB": "subnE",
    "\u2ACB\uFE00": "vsubnE",
    "\u2ACC": "supnE",
    "\u2ACC\uFE00": "vsupnE",
    "\u2ACF": "csub",
    "\u2AD0": "csup",
    "\u2AD1": "csube",
    "\u2AD2": "csupe",
    "\u2AD3": "subsup",
    "\u2AD4": "supsub",
    "\u2AD5": "subsub",
    "\u2AD6": "supsup",
    "\u2AD7": "suphsub",
    "\u2AD8": "supdsub",
    "\u2AD9": "forkv",
    "\u2ADA": "topfork",
    "\u2ADB": "mlcp",
    "\u2AE4": "Dashv",
    "\u2AE6": "Vdashl",
    "\u2AE7": "Barv",
    "\u2AE8": "vBar",
    "\u2AE9": "vBarv",
    "\u2AEB": "Vbar",
    "\u2AEC": "Not",
    "\u2AED": "bNot",
    "\u2AEE": "rnmid",
    "\u2AEF": "cirmid",
    "\u2AF0": "midcir",
    "\u2AF1": "topcir",
    "\u2AF2": "nhpar",
    "\u2AF3": "parsim",
    "\u2AFD": "parsl",
    "\u2AFD\u20E5": "nparsl",
    "\uD835\uDC9C": "Ascr",
    "\uD835\uDC9E": "Cscr",
    "\uD835\uDC9F": "Dscr",
    "\uD835\uDCA2": "Gscr",
    "\uD835\uDCA5": "Jscr",
    "\uD835\uDCA6": "Kscr",
    "\uD835\uDCA9": "Nscr",
    "\uD835\uDCAA": "Oscr",
    "\uD835\uDCAB": "Pscr",
    "\uD835\uDCAC": "Qscr",
    "\uD835\uDCAE": "Sscr",
    "\uD835\uDCAF": "Tscr",
    "\uD835\uDCB0": "Uscr",
    "\uD835\uDCB1": "Vscr",
    "\uD835\uDCB2": "Wscr",
    "\uD835\uDCB3": "Xscr",
    "\uD835\uDCB4": "Yscr",
    "\uD835\uDCB5": "Zscr",
    "\uD835\uDCB6": "ascr",
    "\uD835\uDCB7": "bscr",
    "\uD835\uDCB8": "cscr",
    "\uD835\uDCB9": "dscr",
    "\uD835\uDCBB": "fscr",
    "\uD835\uDCBD": "hscr",
    "\uD835\uDCBE": "iscr",
    "\uD835\uDCBF": "jscr",
    "\uD835\uDCC0": "kscr",
    "\uD835\uDCC1": "lscr",
    "\uD835\uDCC2": "mscr",
    "\uD835\uDCC3": "nscr",
    "\uD835\uDCC5": "pscr",
    "\uD835\uDCC6": "qscr",
    "\uD835\uDCC7": "rscr",
    "\uD835\uDCC8": "sscr",
    "\uD835\uDCC9": "tscr",
    "\uD835\uDCCA": "uscr",
    "\uD835\uDCCB": "vscr",
    "\uD835\uDCCC": "wscr",
    "\uD835\uDCCD": "xscr",
    "\uD835\uDCCE": "yscr",
    "\uD835\uDCCF": "zscr",
    "\uD835\uDD04": "Afr",
    "\uD835\uDD05": "Bfr",
    "\uD835\uDD07": "Dfr",
    "\uD835\uDD08": "Efr",
    "\uD835\uDD09": "Ffr",
    "\uD835\uDD0A": "Gfr",
    "\uD835\uDD0D": "Jfr",
    "\uD835\uDD0E": "Kfr",
    "\uD835\uDD0F": "Lfr",
    "\uD835\uDD10": "Mfr",
    "\uD835\uDD11": "Nfr",
    "\uD835\uDD12": "Ofr",
    "\uD835\uDD13": "Pfr",
    "\uD835\uDD14": "Qfr",
    "\uD835\uDD16": "Sfr",
    "\uD835\uDD17": "Tfr",
    "\uD835\uDD18": "Ufr",
    "\uD835\uDD19": "Vfr",
    "\uD835\uDD1A": "Wfr",
    "\uD835\uDD1B": "Xfr",
    "\uD835\uDD1C": "Yfr",
    "\uD835\uDD1E": "afr",
    "\uD835\uDD1F": "bfr",
    "\uD835\uDD20": "cfr",
    "\uD835\uDD21": "dfr",
    "\uD835\uDD22": "efr",
    "\uD835\uDD23": "ffr",
    "\uD835\uDD24": "gfr",
    "\uD835\uDD25": "hfr",
    "\uD835\uDD26": "ifr",
    "\uD835\uDD27": "jfr",
    "\uD835\uDD28": "kfr",
    "\uD835\uDD29": "lfr",
    "\uD835\uDD2A": "mfr",
    "\uD835\uDD2B": "nfr",
    "\uD835\uDD2C": "ofr",
    "\uD835\uDD2D": "pfr",
    "\uD835\uDD2E": "qfr",
    "\uD835\uDD2F": "rfr",
    "\uD835\uDD30": "sfr",
    "\uD835\uDD31": "tfr",
    "\uD835\uDD32": "ufr",
    "\uD835\uDD33": "vfr",
    "\uD835\uDD34": "wfr",
    "\uD835\uDD35": "xfr",
    "\uD835\uDD36": "yfr",
    "\uD835\uDD37": "zfr",
    "\uD835\uDD38": "Aopf",
    "\uD835\uDD39": "Bopf",
    "\uD835\uDD3B": "Dopf",
    "\uD835\uDD3C": "Eopf",
    "\uD835\uDD3D": "Fopf",
    "\uD835\uDD3E": "Gopf",
    "\uD835\uDD40": "Iopf",
    "\uD835\uDD41": "Jopf",
    "\uD835\uDD42": "Kopf",
    "\uD835\uDD43": "Lopf",
    "\uD835\uDD44": "Mopf",
    "\uD835\uDD46": "Oopf",
    "\uD835\uDD4A": "Sopf",
    "\uD835\uDD4B": "Topf",
    "\uD835\uDD4C": "Uopf",
    "\uD835\uDD4D": "Vopf",
    "\uD835\uDD4E": "Wopf",
    "\uD835\uDD4F": "Xopf",
    "\uD835\uDD50": "Yopf",
    "\uD835\uDD52": "aopf",
    "\uD835\uDD53": "bopf",
    "\uD835\uDD54": "copf",
    "\uD835\uDD55": "dopf",
    "\uD835\uDD56": "eopf",
    "\uD835\uDD57": "fopf",
    "\uD835\uDD58": "gopf",
    "\uD835\uDD59": "hopf",
    "\uD835\uDD5A": "iopf",
    "\uD835\uDD5B": "jopf",
    "\uD835\uDD5C": "kopf",
    "\uD835\uDD5D": "lopf",
    "\uD835\uDD5E": "mopf",
    "\uD835\uDD5F": "nopf",
    "\uD835\uDD60": "oopf",
    "\uD835\uDD61": "popf",
    "\uD835\uDD62": "qopf",
    "\uD835\uDD63": "ropf",
    "\uD835\uDD64": "sopf",
    "\uD835\uDD65": "topf",
    "\uD835\uDD66": "uopf",
    "\uD835\uDD67": "vopf",
    "\uD835\uDD68": "wopf",
    "\uD835\uDD69": "xopf",
    "\uD835\uDD6A": "yopf",
    "\uD835\uDD6B": "zopf",
    "\uFB00": "fflig",
    "\uFB01": "filig",
    "\uFB02": "fllig",
    "\uFB03": "ffilig",
    "\uFB04": "ffllig"
});
define("file:///home/sdorries/repos/github/he/src/data/invalid-character-reference-code-points", [], [
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    11,
    13,
    14,
    15,
    16,
    17,
    18,
    19,
    20,
    21,
    22,
    23,
    24,
    25,
    26,
    27,
    28,
    29,
    30,
    31,
    127,
    128,
    129,
    130,
    131,
    132,
    133,
    134,
    135,
    136,
    137,
    138,
    139,
    140,
    141,
    142,
    143,
    144,
    145,
    146,
    147,
    148,
    149,
    150,
    151,
    152,
    153,
    154,
    155,
    156,
    157,
    158,
    159,
    64976,
    64977,
    64978,
    64979,
    64980,
    64981,
    64982,
    64983,
    64984,
    64985,
    64986,
    64987,
    64988,
    64989,
    64990,
    64991,
    64992,
    64993,
    64994,
    64995,
    64996,
    64997,
    64998,
    64999,
    65000,
    65001,
    65002,
    65003,
    65004,
    65005,
    65006,
    65007,
    65534,
    65535,
    131070,
    131071,
    196606,
    196607,
    262142,
    262143,
    327678,
    327679,
    393214,
    393215,
    458750,
    458751,
    524286,
    524287,
    589822,
    589823,
    655358,
    655359,
    720894,
    720895,
    786430,
    786431,
    851966,
    851967,
    917502,
    917503,
    983038,
    983039,
    1048574,
    1048575,
    1114110,
    1114111
]);
define("file:///home/sdorries/repos/github/he/src/data/entities", [], {
    "&AElig": { "codepoints": [198], "characters": "\u00C6" },
    "&AElig;": { "codepoints": [198], "characters": "\u00C6" },
    "&AMP": { "codepoints": [38], "characters": "\u0026" },
    "&AMP;": { "codepoints": [38], "characters": "\u0026" },
    "&Aacute": { "codepoints": [193], "characters": "\u00C1" },
    "&Aacute;": { "codepoints": [193], "characters": "\u00C1" },
    "&Abreve;": { "codepoints": [258], "characters": "\u0102" },
    "&Acirc": { "codepoints": [194], "characters": "\u00C2" },
    "&Acirc;": { "codepoints": [194], "characters": "\u00C2" },
    "&Acy;": { "codepoints": [1040], "characters": "\u0410" },
    "&Afr;": { "codepoints": [120068], "characters": "\uD835\uDD04" },
    "&Agrave": { "codepoints": [192], "characters": "\u00C0" },
    "&Agrave;": { "codepoints": [192], "characters": "\u00C0" },
    "&Alpha;": { "codepoints": [913], "characters": "\u0391" },
    "&Amacr;": { "codepoints": [256], "characters": "\u0100" },
    "&And;": { "codepoints": [10835], "characters": "\u2A53" },
    "&Aogon;": { "codepoints": [260], "characters": "\u0104" },
    "&Aopf;": { "codepoints": [120120], "characters": "\uD835\uDD38" },
    "&ApplyFunction;": { "codepoints": [8289], "characters": "\u2061" },
    "&Aring": { "codepoints": [197], "characters": "\u00C5" },
    "&Aring;": { "codepoints": [197], "characters": "\u00C5" },
    "&Ascr;": { "codepoints": [119964], "characters": "\uD835\uDC9C" },
    "&Assign;": { "codepoints": [8788], "characters": "\u2254" },
    "&Atilde": { "codepoints": [195], "characters": "\u00C3" },
    "&Atilde;": { "codepoints": [195], "characters": "\u00C3" },
    "&Auml": { "codepoints": [196], "characters": "\u00C4" },
    "&Auml;": { "codepoints": [196], "characters": "\u00C4" },
    "&Backslash;": { "codepoints": [8726], "characters": "\u2216" },
    "&Barv;": { "codepoints": [10983], "characters": "\u2AE7" },
    "&Barwed;": { "codepoints": [8966], "characters": "\u2306" },
    "&Bcy;": { "codepoints": [1041], "characters": "\u0411" },
    "&Because;": { "codepoints": [8757], "characters": "\u2235" },
    "&Bernoullis;": { "codepoints": [8492], "characters": "\u212C" },
    "&Beta;": { "codepoints": [914], "characters": "\u0392" },
    "&Bfr;": { "codepoints": [120069], "characters": "\uD835\uDD05" },
    "&Bopf;": { "codepoints": [120121], "characters": "\uD835\uDD39" },
    "&Breve;": { "codepoints": [728], "characters": "\u02D8" },
    "&Bscr;": { "codepoints": [8492], "characters": "\u212C" },
    "&Bumpeq;": { "codepoints": [8782], "characters": "\u224E" },
    "&CHcy;": { "codepoints": [1063], "characters": "\u0427" },
    "&COPY": { "codepoints": [169], "characters": "\u00A9" },
    "&COPY;": { "codepoints": [169], "characters": "\u00A9" },
    "&Cacute;": { "codepoints": [262], "characters": "\u0106" },
    "&Cap;": { "codepoints": [8914], "characters": "\u22D2" },
    "&CapitalDifferentialD;": { "codepoints": [8517], "characters": "\u2145" },
    "&Cayleys;": { "codepoints": [8493], "characters": "\u212D" },
    "&Ccaron;": { "codepoints": [268], "characters": "\u010C" },
    "&Ccedil": { "codepoints": [199], "characters": "\u00C7" },
    "&Ccedil;": { "codepoints": [199], "characters": "\u00C7" },
    "&Ccirc;": { "codepoints": [264], "characters": "\u0108" },
    "&Cconint;": { "codepoints": [8752], "characters": "\u2230" },
    "&Cdot;": { "codepoints": [266], "characters": "\u010A" },
    "&Cedilla;": { "codepoints": [184], "characters": "\u00B8" },
    "&CenterDot;": { "codepoints": [183], "characters": "\u00B7" },
    "&Cfr;": { "codepoints": [8493], "characters": "\u212D" },
    "&Chi;": { "codepoints": [935], "characters": "\u03A7" },
    "&CircleDot;": { "codepoints": [8857], "characters": "\u2299" },
    "&CircleMinus;": { "codepoints": [8854], "characters": "\u2296" },
    "&CirclePlus;": { "codepoints": [8853], "characters": "\u2295" },
    "&CircleTimes;": { "codepoints": [8855], "characters": "\u2297" },
    "&ClockwiseContourIntegral;": { "codepoints": [8754], "characters": "\u2232" },
    "&CloseCurlyDoubleQuote;": { "codepoints": [8221], "characters": "\u201D" },
    "&CloseCurlyQuote;": { "codepoints": [8217], "characters": "\u2019" },
    "&Colon;": { "codepoints": [8759], "characters": "\u2237" },
    "&Colone;": { "codepoints": [10868], "characters": "\u2A74" },
    "&Congruent;": { "codepoints": [8801], "characters": "\u2261" },
    "&Conint;": { "codepoints": [8751], "characters": "\u222F" },
    "&ContourIntegral;": { "codepoints": [8750], "characters": "\u222E" },
    "&Copf;": { "codepoints": [8450], "characters": "\u2102" },
    "&Coproduct;": { "codepoints": [8720], "characters": "\u2210" },
    "&CounterClockwiseContourIntegral;": { "codepoints": [8755], "characters": "\u2233" },
    "&Cross;": { "codepoints": [10799], "characters": "\u2A2F" },
    "&Cscr;": { "codepoints": [119966], "characters": "\uD835\uDC9E" },
    "&Cup;": { "codepoints": [8915], "characters": "\u22D3" },
    "&CupCap;": { "codepoints": [8781], "characters": "\u224D" },
    "&DD;": { "codepoints": [8517], "characters": "\u2145" },
    "&DDotrahd;": { "codepoints": [10513], "characters": "\u2911" },
    "&DJcy;": { "codepoints": [1026], "characters": "\u0402" },
    "&DScy;": { "codepoints": [1029], "characters": "\u0405" },
    "&DZcy;": { "codepoints": [1039], "characters": "\u040F" },
    "&Dagger;": { "codepoints": [8225], "characters": "\u2021" },
    "&Darr;": { "codepoints": [8609], "characters": "\u21A1" },
    "&Dashv;": { "codepoints": [10980], "characters": "\u2AE4" },
    "&Dcaron;": { "codepoints": [270], "characters": "\u010E" },
    "&Dcy;": { "codepoints": [1044], "characters": "\u0414" },
    "&Del;": { "codepoints": [8711], "characters": "\u2207" },
    "&Delta;": { "codepoints": [916], "characters": "\u0394" },
    "&Dfr;": { "codepoints": [120071], "characters": "\uD835\uDD07" },
    "&DiacriticalAcute;": { "codepoints": [180], "characters": "\u00B4" },
    "&DiacriticalDot;": { "codepoints": [729], "characters": "\u02D9" },
    "&DiacriticalDoubleAcute;": { "codepoints": [733], "characters": "\u02DD" },
    "&DiacriticalGrave;": { "codepoints": [96], "characters": "\u0060" },
    "&DiacriticalTilde;": { "codepoints": [732], "characters": "\u02DC" },
    "&Diamond;": { "codepoints": [8900], "characters": "\u22C4" },
    "&DifferentialD;": { "codepoints": [8518], "characters": "\u2146" },
    "&Dopf;": { "codepoints": [120123], "characters": "\uD835\uDD3B" },
    "&Dot;": { "codepoints": [168], "characters": "\u00A8" },
    "&DotDot;": { "codepoints": [8412], "characters": "\u20DC" },
    "&DotEqual;": { "codepoints": [8784], "characters": "\u2250" },
    "&DoubleContourIntegral;": { "codepoints": [8751], "characters": "\u222F" },
    "&DoubleDot;": { "codepoints": [168], "characters": "\u00A8" },
    "&DoubleDownArrow;": { "codepoints": [8659], "characters": "\u21D3" },
    "&DoubleLeftArrow;": { "codepoints": [8656], "characters": "\u21D0" },
    "&DoubleLeftRightArrow;": { "codepoints": [8660], "characters": "\u21D4" },
    "&DoubleLeftTee;": { "codepoints": [10980], "characters": "\u2AE4" },
    "&DoubleLongLeftArrow;": { "codepoints": [10232], "characters": "\u27F8" },
    "&DoubleLongLeftRightArrow;": { "codepoints": [10234], "characters": "\u27FA" },
    "&DoubleLongRightArrow;": { "codepoints": [10233], "characters": "\u27F9" },
    "&DoubleRightArrow;": { "codepoints": [8658], "characters": "\u21D2" },
    "&DoubleRightTee;": { "codepoints": [8872], "characters": "\u22A8" },
    "&DoubleUpArrow;": { "codepoints": [8657], "characters": "\u21D1" },
    "&DoubleUpDownArrow;": { "codepoints": [8661], "characters": "\u21D5" },
    "&DoubleVerticalBar;": { "codepoints": [8741], "characters": "\u2225" },
    "&DownArrow;": { "codepoints": [8595], "characters": "\u2193" },
    "&DownArrowBar;": { "codepoints": [10515], "characters": "\u2913" },
    "&DownArrowUpArrow;": { "codepoints": [8693], "characters": "\u21F5" },
    "&DownBreve;": { "codepoints": [785], "characters": "\u0311" },
    "&DownLeftRightVector;": { "codepoints": [10576], "characters": "\u2950" },
    "&DownLeftTeeVector;": { "codepoints": [10590], "characters": "\u295E" },
    "&DownLeftVector;": { "codepoints": [8637], "characters": "\u21BD" },
    "&DownLeftVectorBar;": { "codepoints": [10582], "characters": "\u2956" },
    "&DownRightTeeVector;": { "codepoints": [10591], "characters": "\u295F" },
    "&DownRightVector;": { "codepoints": [8641], "characters": "\u21C1" },
    "&DownRightVectorBar;": { "codepoints": [10583], "characters": "\u2957" },
    "&DownTee;": { "codepoints": [8868], "characters": "\u22A4" },
    "&DownTeeArrow;": { "codepoints": [8615], "characters": "\u21A7" },
    "&Downarrow;": { "codepoints": [8659], "characters": "\u21D3" },
    "&Dscr;": { "codepoints": [119967], "characters": "\uD835\uDC9F" },
    "&Dstrok;": { "codepoints": [272], "characters": "\u0110" },
    "&ENG;": { "codepoints": [330], "characters": "\u014A" },
    "&ETH": { "codepoints": [208], "characters": "\u00D0" },
    "&ETH;": { "codepoints": [208], "characters": "\u00D0" },
    "&Eacute": { "codepoints": [201], "characters": "\u00C9" },
    "&Eacute;": { "codepoints": [201], "characters": "\u00C9" },
    "&Ecaron;": { "codepoints": [282], "characters": "\u011A" },
    "&Ecirc": { "codepoints": [202], "characters": "\u00CA" },
    "&Ecirc;": { "codepoints": [202], "characters": "\u00CA" },
    "&Ecy;": { "codepoints": [1069], "characters": "\u042D" },
    "&Edot;": { "codepoints": [278], "characters": "\u0116" },
    "&Efr;": { "codepoints": [120072], "characters": "\uD835\uDD08" },
    "&Egrave": { "codepoints": [200], "characters": "\u00C8" },
    "&Egrave;": { "codepoints": [200], "characters": "\u00C8" },
    "&Element;": { "codepoints": [8712], "characters": "\u2208" },
    "&Emacr;": { "codepoints": [274], "characters": "\u0112" },
    "&EmptySmallSquare;": { "codepoints": [9723], "characters": "\u25FB" },
    "&EmptyVerySmallSquare;": { "codepoints": [9643], "characters": "\u25AB" },
    "&Eogon;": { "codepoints": [280], "characters": "\u0118" },
    "&Eopf;": { "codepoints": [120124], "characters": "\uD835\uDD3C" },
    "&Epsilon;": { "codepoints": [917], "characters": "\u0395" },
    "&Equal;": { "codepoints": [10869], "characters": "\u2A75" },
    "&EqualTilde;": { "codepoints": [8770], "characters": "\u2242" },
    "&Equilibrium;": { "codepoints": [8652], "characters": "\u21CC" },
    "&Escr;": { "codepoints": [8496], "characters": "\u2130" },
    "&Esim;": { "codepoints": [10867], "characters": "\u2A73" },
    "&Eta;": { "codepoints": [919], "characters": "\u0397" },
    "&Euml": { "codepoints": [203], "characters": "\u00CB" },
    "&Euml;": { "codepoints": [203], "characters": "\u00CB" },
    "&Exists;": { "codepoints": [8707], "characters": "\u2203" },
    "&ExponentialE;": { "codepoints": [8519], "characters": "\u2147" },
    "&Fcy;": { "codepoints": [1060], "characters": "\u0424" },
    "&Ffr;": { "codepoints": [120073], "characters": "\uD835\uDD09" },
    "&FilledSmallSquare;": { "codepoints": [9724], "characters": "\u25FC" },
    "&FilledVerySmallSquare;": { "codepoints": [9642], "characters": "\u25AA" },
    "&Fopf;": { "codepoints": [120125], "characters": "\uD835\uDD3D" },
    "&ForAll;": { "codepoints": [8704], "characters": "\u2200" },
    "&Fouriertrf;": { "codepoints": [8497], "characters": "\u2131" },
    "&Fscr;": { "codepoints": [8497], "characters": "\u2131" },
    "&GJcy;": { "codepoints": [1027], "characters": "\u0403" },
    "&GT": { "codepoints": [62], "characters": "\u003E" },
    "&GT;": { "codepoints": [62], "characters": "\u003E" },
    "&Gamma;": { "codepoints": [915], "characters": "\u0393" },
    "&Gammad;": { "codepoints": [988], "characters": "\u03DC" },
    "&Gbreve;": { "codepoints": [286], "characters": "\u011E" },
    "&Gcedil;": { "codepoints": [290], "characters": "\u0122" },
    "&Gcirc;": { "codepoints": [284], "characters": "\u011C" },
    "&Gcy;": { "codepoints": [1043], "characters": "\u0413" },
    "&Gdot;": { "codepoints": [288], "characters": "\u0120" },
    "&Gfr;": { "codepoints": [120074], "characters": "\uD835\uDD0A" },
    "&Gg;": { "codepoints": [8921], "characters": "\u22D9" },
    "&Gopf;": { "codepoints": [120126], "characters": "\uD835\uDD3E" },
    "&GreaterEqual;": { "codepoints": [8805], "characters": "\u2265" },
    "&GreaterEqualLess;": { "codepoints": [8923], "characters": "\u22DB" },
    "&GreaterFullEqual;": { "codepoints": [8807], "characters": "\u2267" },
    "&GreaterGreater;": { "codepoints": [10914], "characters": "\u2AA2" },
    "&GreaterLess;": { "codepoints": [8823], "characters": "\u2277" },
    "&GreaterSlantEqual;": { "codepoints": [10878], "characters": "\u2A7E" },
    "&GreaterTilde;": { "codepoints": [8819], "characters": "\u2273" },
    "&Gscr;": { "codepoints": [119970], "characters": "\uD835\uDCA2" },
    "&Gt;": { "codepoints": [8811], "characters": "\u226B" },
    "&HARDcy;": { "codepoints": [1066], "characters": "\u042A" },
    "&Hacek;": { "codepoints": [711], "characters": "\u02C7" },
    "&Hat;": { "codepoints": [94], "characters": "\u005E" },
    "&Hcirc;": { "codepoints": [292], "characters": "\u0124" },
    "&Hfr;": { "codepoints": [8460], "characters": "\u210C" },
    "&HilbertSpace;": { "codepoints": [8459], "characters": "\u210B" },
    "&Hopf;": { "codepoints": [8461], "characters": "\u210D" },
    "&HorizontalLine;": { "codepoints": [9472], "characters": "\u2500" },
    "&Hscr;": { "codepoints": [8459], "characters": "\u210B" },
    "&Hstrok;": { "codepoints": [294], "characters": "\u0126" },
    "&HumpDownHump;": { "codepoints": [8782], "characters": "\u224E" },
    "&HumpEqual;": { "codepoints": [8783], "characters": "\u224F" },
    "&IEcy;": { "codepoints": [1045], "characters": "\u0415" },
    "&IJlig;": { "codepoints": [306], "characters": "\u0132" },
    "&IOcy;": { "codepoints": [1025], "characters": "\u0401" },
    "&Iacute": { "codepoints": [205], "characters": "\u00CD" },
    "&Iacute;": { "codepoints": [205], "characters": "\u00CD" },
    "&Icirc": { "codepoints": [206], "characters": "\u00CE" },
    "&Icirc;": { "codepoints": [206], "characters": "\u00CE" },
    "&Icy;": { "codepoints": [1048], "characters": "\u0418" },
    "&Idot;": { "codepoints": [304], "characters": "\u0130" },
    "&Ifr;": { "codepoints": [8465], "characters": "\u2111" },
    "&Igrave": { "codepoints": [204], "characters": "\u00CC" },
    "&Igrave;": { "codepoints": [204], "characters": "\u00CC" },
    "&Im;": { "codepoints": [8465], "characters": "\u2111" },
    "&Imacr;": { "codepoints": [298], "characters": "\u012A" },
    "&ImaginaryI;": { "codepoints": [8520], "characters": "\u2148" },
    "&Implies;": { "codepoints": [8658], "characters": "\u21D2" },
    "&Int;": { "codepoints": [8748], "characters": "\u222C" },
    "&Integral;": { "codepoints": [8747], "characters": "\u222B" },
    "&Intersection;": { "codepoints": [8898], "characters": "\u22C2" },
    "&InvisibleComma;": { "codepoints": [8291], "characters": "\u2063" },
    "&InvisibleTimes;": { "codepoints": [8290], "characters": "\u2062" },
    "&Iogon;": { "codepoints": [302], "characters": "\u012E" },
    "&Iopf;": { "codepoints": [120128], "characters": "\uD835\uDD40" },
    "&Iota;": { "codepoints": [921], "characters": "\u0399" },
    "&Iscr;": { "codepoints": [8464], "characters": "\u2110" },
    "&Itilde;": { "codepoints": [296], "characters": "\u0128" },
    "&Iukcy;": { "codepoints": [1030], "characters": "\u0406" },
    "&Iuml": { "codepoints": [207], "characters": "\u00CF" },
    "&Iuml;": { "codepoints": [207], "characters": "\u00CF" },
    "&Jcirc;": { "codepoints": [308], "characters": "\u0134" },
    "&Jcy;": { "codepoints": [1049], "characters": "\u0419" },
    "&Jfr;": { "codepoints": [120077], "characters": "\uD835\uDD0D" },
    "&Jopf;": { "codepoints": [120129], "characters": "\uD835\uDD41" },
    "&Jscr;": { "codepoints": [119973], "characters": "\uD835\uDCA5" },
    "&Jsercy;": { "codepoints": [1032], "characters": "\u0408" },
    "&Jukcy;": { "codepoints": [1028], "characters": "\u0404" },
    "&KHcy;": { "codepoints": [1061], "characters": "\u0425" },
    "&KJcy;": { "codepoints": [1036], "characters": "\u040C" },
    "&Kappa;": { "codepoints": [922], "characters": "\u039A" },
    "&Kcedil;": { "codepoints": [310], "characters": "\u0136" },
    "&Kcy;": { "codepoints": [1050], "characters": "\u041A" },
    "&Kfr;": { "codepoints": [120078], "characters": "\uD835\uDD0E" },
    "&Kopf;": { "codepoints": [120130], "characters": "\uD835\uDD42" },
    "&Kscr;": { "codepoints": [119974], "characters": "\uD835\uDCA6" },
    "&LJcy;": { "codepoints": [1033], "characters": "\u0409" },
    "&LT": { "codepoints": [60], "characters": "\u003C" },
    "&LT;": { "codepoints": [60], "characters": "\u003C" },
    "&Lacute;": { "codepoints": [313], "characters": "\u0139" },
    "&Lambda;": { "codepoints": [923], "characters": "\u039B" },
    "&Lang;": { "codepoints": [10218], "characters": "\u27EA" },
    "&Laplacetrf;": { "codepoints": [8466], "characters": "\u2112" },
    "&Larr;": { "codepoints": [8606], "characters": "\u219E" },
    "&Lcaron;": { "codepoints": [317], "characters": "\u013D" },
    "&Lcedil;": { "codepoints": [315], "characters": "\u013B" },
    "&Lcy;": { "codepoints": [1051], "characters": "\u041B" },
    "&LeftAngleBracket;": { "codepoints": [10216], "characters": "\u27E8" },
    "&LeftArrow;": { "codepoints": [8592], "characters": "\u2190" },
    "&LeftArrowBar;": { "codepoints": [8676], "characters": "\u21E4" },
    "&LeftArrowRightArrow;": { "codepoints": [8646], "characters": "\u21C6" },
    "&LeftCeiling;": { "codepoints": [8968], "characters": "\u2308" },
    "&LeftDoubleBracket;": { "codepoints": [10214], "characters": "\u27E6" },
    "&LeftDownTeeVector;": { "codepoints": [10593], "characters": "\u2961" },
    "&LeftDownVector;": { "codepoints": [8643], "characters": "\u21C3" },
    "&LeftDownVectorBar;": { "codepoints": [10585], "characters": "\u2959" },
    "&LeftFloor;": { "codepoints": [8970], "characters": "\u230A" },
    "&LeftRightArrow;": { "codepoints": [8596], "characters": "\u2194" },
    "&LeftRightVector;": { "codepoints": [10574], "characters": "\u294E" },
    "&LeftTee;": { "codepoints": [8867], "characters": "\u22A3" },
    "&LeftTeeArrow;": { "codepoints": [8612], "characters": "\u21A4" },
    "&LeftTeeVector;": { "codepoints": [10586], "characters": "\u295A" },
    "&LeftTriangle;": { "codepoints": [8882], "characters": "\u22B2" },
    "&LeftTriangleBar;": { "codepoints": [10703], "characters": "\u29CF" },
    "&LeftTriangleEqual;": { "codepoints": [8884], "characters": "\u22B4" },
    "&LeftUpDownVector;": { "codepoints": [10577], "characters": "\u2951" },
    "&LeftUpTeeVector;": { "codepoints": [10592], "characters": "\u2960" },
    "&LeftUpVector;": { "codepoints": [8639], "characters": "\u21BF" },
    "&LeftUpVectorBar;": { "codepoints": [10584], "characters": "\u2958" },
    "&LeftVector;": { "codepoints": [8636], "characters": "\u21BC" },
    "&LeftVectorBar;": { "codepoints": [10578], "characters": "\u2952" },
    "&Leftarrow;": { "codepoints": [8656], "characters": "\u21D0" },
    "&Leftrightarrow;": { "codepoints": [8660], "characters": "\u21D4" },
    "&LessEqualGreater;": { "codepoints": [8922], "characters": "\u22DA" },
    "&LessFullEqual;": { "codepoints": [8806], "characters": "\u2266" },
    "&LessGreater;": { "codepoints": [8822], "characters": "\u2276" },
    "&LessLess;": { "codepoints": [10913], "characters": "\u2AA1" },
    "&LessSlantEqual;": { "codepoints": [10877], "characters": "\u2A7D" },
    "&LessTilde;": { "codepoints": [8818], "characters": "\u2272" },
    "&Lfr;": { "codepoints": [120079], "characters": "\uD835\uDD0F" },
    "&Ll;": { "codepoints": [8920], "characters": "\u22D8" },
    "&Lleftarrow;": { "codepoints": [8666], "characters": "\u21DA" },
    "&Lmidot;": { "codepoints": [319], "characters": "\u013F" },
    "&LongLeftArrow;": { "codepoints": [10229], "characters": "\u27F5" },
    "&LongLeftRightArrow;": { "codepoints": [10231], "characters": "\u27F7" },
    "&LongRightArrow;": { "codepoints": [10230], "characters": "\u27F6" },
    "&Longleftarrow;": { "codepoints": [10232], "characters": "\u27F8" },
    "&Longleftrightarrow;": { "codepoints": [10234], "characters": "\u27FA" },
    "&Longrightarrow;": { "codepoints": [10233], "characters": "\u27F9" },
    "&Lopf;": { "codepoints": [120131], "characters": "\uD835\uDD43" },
    "&LowerLeftArrow;": { "codepoints": [8601], "characters": "\u2199" },
    "&LowerRightArrow;": { "codepoints": [8600], "characters": "\u2198" },
    "&Lscr;": { "codepoints": [8466], "characters": "\u2112" },
    "&Lsh;": { "codepoints": [8624], "characters": "\u21B0" },
    "&Lstrok;": { "codepoints": [321], "characters": "\u0141" },
    "&Lt;": { "codepoints": [8810], "characters": "\u226A" },
    "&Map;": { "codepoints": [10501], "characters": "\u2905" },
    "&Mcy;": { "codepoints": [1052], "characters": "\u041C" },
    "&MediumSpace;": { "codepoints": [8287], "characters": "\u205F" },
    "&Mellintrf;": { "codepoints": [8499], "characters": "\u2133" },
    "&Mfr;": { "codepoints": [120080], "characters": "\uD835\uDD10" },
    "&MinusPlus;": { "codepoints": [8723], "characters": "\u2213" },
    "&Mopf;": { "codepoints": [120132], "characters": "\uD835\uDD44" },
    "&Mscr;": { "codepoints": [8499], "characters": "\u2133" },
    "&Mu;": { "codepoints": [924], "characters": "\u039C" },
    "&NJcy;": { "codepoints": [1034], "characters": "\u040A" },
    "&Nacute;": { "codepoints": [323], "characters": "\u0143" },
    "&Ncaron;": { "codepoints": [327], "characters": "\u0147" },
    "&Ncedil;": { "codepoints": [325], "characters": "\u0145" },
    "&Ncy;": { "codepoints": [1053], "characters": "\u041D" },
    "&NegativeMediumSpace;": { "codepoints": [8203], "characters": "\u200B" },
    "&NegativeThickSpace;": { "codepoints": [8203], "characters": "\u200B" },
    "&NegativeThinSpace;": { "codepoints": [8203], "characters": "\u200B" },
    "&NegativeVeryThinSpace;": { "codepoints": [8203], "characters": "\u200B" },
    "&NestedGreaterGreater;": { "codepoints": [8811], "characters": "\u226B" },
    "&NestedLessLess;": { "codepoints": [8810], "characters": "\u226A" },
    "&NewLine;": { "codepoints": [10], "characters": "\u000A" },
    "&Nfr;": { "codepoints": [120081], "characters": "\uD835\uDD11" },
    "&NoBreak;": { "codepoints": [8288], "characters": "\u2060" },
    "&NonBreakingSpace;": { "codepoints": [160], "characters": "\u00A0" },
    "&Nopf;": { "codepoints": [8469], "characters": "\u2115" },
    "&Not;": { "codepoints": [10988], "characters": "\u2AEC" },
    "&NotCongruent;": { "codepoints": [8802], "characters": "\u2262" },
    "&NotCupCap;": { "codepoints": [8813], "characters": "\u226D" },
    "&NotDoubleVerticalBar;": { "codepoints": [8742], "characters": "\u2226" },
    "&NotElement;": { "codepoints": [8713], "characters": "\u2209" },
    "&NotEqual;": { "codepoints": [8800], "characters": "\u2260" },
    "&NotEqualTilde;": { "codepoints": [8770, 824], "characters": "\u2242\u0338" },
    "&NotExists;": { "codepoints": [8708], "characters": "\u2204" },
    "&NotGreater;": { "codepoints": [8815], "characters": "\u226F" },
    "&NotGreaterEqual;": { "codepoints": [8817], "characters": "\u2271" },
    "&NotGreaterFullEqual;": { "codepoints": [8807, 824], "characters": "\u2267\u0338" },
    "&NotGreaterGreater;": { "codepoints": [8811, 824], "characters": "\u226B\u0338" },
    "&NotGreaterLess;": { "codepoints": [8825], "characters": "\u2279" },
    "&NotGreaterSlantEqual;": { "codepoints": [10878, 824], "characters": "\u2A7E\u0338" },
    "&NotGreaterTilde;": { "codepoints": [8821], "characters": "\u2275" },
    "&NotHumpDownHump;": { "codepoints": [8782, 824], "characters": "\u224E\u0338" },
    "&NotHumpEqual;": { "codepoints": [8783, 824], "characters": "\u224F\u0338" },
    "&NotLeftTriangle;": { "codepoints": [8938], "characters": "\u22EA" },
    "&NotLeftTriangleBar;": { "codepoints": [10703, 824], "characters": "\u29CF\u0338" },
    "&NotLeftTriangleEqual;": { "codepoints": [8940], "characters": "\u22EC" },
    "&NotLess;": { "codepoints": [8814], "characters": "\u226E" },
    "&NotLessEqual;": { "codepoints": [8816], "characters": "\u2270" },
    "&NotLessGreater;": { "codepoints": [8824], "characters": "\u2278" },
    "&NotLessLess;": { "codepoints": [8810, 824], "characters": "\u226A\u0338" },
    "&NotLessSlantEqual;": { "codepoints": [10877, 824], "characters": "\u2A7D\u0338" },
    "&NotLessTilde;": { "codepoints": [8820], "characters": "\u2274" },
    "&NotNestedGreaterGreater;": { "codepoints": [10914, 824], "characters": "\u2AA2\u0338" },
    "&NotNestedLessLess;": { "codepoints": [10913, 824], "characters": "\u2AA1\u0338" },
    "&NotPrecedes;": { "codepoints": [8832], "characters": "\u2280" },
    "&NotPrecedesEqual;": { "codepoints": [10927, 824], "characters": "\u2AAF\u0338" },
    "&NotPrecedesSlantEqual;": { "codepoints": [8928], "characters": "\u22E0" },
    "&NotReverseElement;": { "codepoints": [8716], "characters": "\u220C" },
    "&NotRightTriangle;": { "codepoints": [8939], "characters": "\u22EB" },
    "&NotRightTriangleBar;": { "codepoints": [10704, 824], "characters": "\u29D0\u0338" },
    "&NotRightTriangleEqual;": { "codepoints": [8941], "characters": "\u22ED" },
    "&NotSquareSubset;": { "codepoints": [8847, 824], "characters": "\u228F\u0338" },
    "&NotSquareSubsetEqual;": { "codepoints": [8930], "characters": "\u22E2" },
    "&NotSquareSuperset;": { "codepoints": [8848, 824], "characters": "\u2290\u0338" },
    "&NotSquareSupersetEqual;": { "codepoints": [8931], "characters": "\u22E3" },
    "&NotSubset;": { "codepoints": [8834, 8402], "characters": "\u2282\u20D2" },
    "&NotSubsetEqual;": { "codepoints": [8840], "characters": "\u2288" },
    "&NotSucceeds;": { "codepoints": [8833], "characters": "\u2281" },
    "&NotSucceedsEqual;": { "codepoints": [10928, 824], "characters": "\u2AB0\u0338" },
    "&NotSucceedsSlantEqual;": { "codepoints": [8929], "characters": "\u22E1" },
    "&NotSucceedsTilde;": { "codepoints": [8831, 824], "characters": "\u227F\u0338" },
    "&NotSuperset;": { "codepoints": [8835, 8402], "characters": "\u2283\u20D2" },
    "&NotSupersetEqual;": { "codepoints": [8841], "characters": "\u2289" },
    "&NotTilde;": { "codepoints": [8769], "characters": "\u2241" },
    "&NotTildeEqual;": { "codepoints": [8772], "characters": "\u2244" },
    "&NotTildeFullEqual;": { "codepoints": [8775], "characters": "\u2247" },
    "&NotTildeTilde;": { "codepoints": [8777], "characters": "\u2249" },
    "&NotVerticalBar;": { "codepoints": [8740], "characters": "\u2224" },
    "&Nscr;": { "codepoints": [119977], "characters": "\uD835\uDCA9" },
    "&Ntilde": { "codepoints": [209], "characters": "\u00D1" },
    "&Ntilde;": { "codepoints": [209], "characters": "\u00D1" },
    "&Nu;": { "codepoints": [925], "characters": "\u039D" },
    "&OElig;": { "codepoints": [338], "characters": "\u0152" },
    "&Oacute": { "codepoints": [211], "characters": "\u00D3" },
    "&Oacute;": { "codepoints": [211], "characters": "\u00D3" },
    "&Ocirc": { "codepoints": [212], "characters": "\u00D4" },
    "&Ocirc;": { "codepoints": [212], "characters": "\u00D4" },
    "&Ocy;": { "codepoints": [1054], "characters": "\u041E" },
    "&Odblac;": { "codepoints": [336], "characters": "\u0150" },
    "&Ofr;": { "codepoints": [120082], "characters": "\uD835\uDD12" },
    "&Ograve": { "codepoints": [210], "characters": "\u00D2" },
    "&Ograve;": { "codepoints": [210], "characters": "\u00D2" },
    "&Omacr;": { "codepoints": [332], "characters": "\u014C" },
    "&Omega;": { "codepoints": [937], "characters": "\u03A9" },
    "&Omicron;": { "codepoints": [927], "characters": "\u039F" },
    "&Oopf;": { "codepoints": [120134], "characters": "\uD835\uDD46" },
    "&OpenCurlyDoubleQuote;": { "codepoints": [8220], "characters": "\u201C" },
    "&OpenCurlyQuote;": { "codepoints": [8216], "characters": "\u2018" },
    "&Or;": { "codepoints": [10836], "characters": "\u2A54" },
    "&Oscr;": { "codepoints": [119978], "characters": "\uD835\uDCAA" },
    "&Oslash": { "codepoints": [216], "characters": "\u00D8" },
    "&Oslash;": { "codepoints": [216], "characters": "\u00D8" },
    "&Otilde": { "codepoints": [213], "characters": "\u00D5" },
    "&Otilde;": { "codepoints": [213], "characters": "\u00D5" },
    "&Otimes;": { "codepoints": [10807], "characters": "\u2A37" },
    "&Ouml": { "codepoints": [214], "characters": "\u00D6" },
    "&Ouml;": { "codepoints": [214], "characters": "\u00D6" },
    "&OverBar;": { "codepoints": [8254], "characters": "\u203E" },
    "&OverBrace;": { "codepoints": [9182], "characters": "\u23DE" },
    "&OverBracket;": { "codepoints": [9140], "characters": "\u23B4" },
    "&OverParenthesis;": { "codepoints": [9180], "characters": "\u23DC" },
    "&PartialD;": { "codepoints": [8706], "characters": "\u2202" },
    "&Pcy;": { "codepoints": [1055], "characters": "\u041F" },
    "&Pfr;": { "codepoints": [120083], "characters": "\uD835\uDD13" },
    "&Phi;": { "codepoints": [934], "characters": "\u03A6" },
    "&Pi;": { "codepoints": [928], "characters": "\u03A0" },
    "&PlusMinus;": { "codepoints": [177], "characters": "\u00B1" },
    "&Poincareplane;": { "codepoints": [8460], "characters": "\u210C" },
    "&Popf;": { "codepoints": [8473], "characters": "\u2119" },
    "&Pr;": { "codepoints": [10939], "characters": "\u2ABB" },
    "&Precedes;": { "codepoints": [8826], "characters": "\u227A" },
    "&PrecedesEqual;": { "codepoints": [10927], "characters": "\u2AAF" },
    "&PrecedesSlantEqual;": { "codepoints": [8828], "characters": "\u227C" },
    "&PrecedesTilde;": { "codepoints": [8830], "characters": "\u227E" },
    "&Prime;": { "codepoints": [8243], "characters": "\u2033" },
    "&Product;": { "codepoints": [8719], "characters": "\u220F" },
    "&Proportion;": { "codepoints": [8759], "characters": "\u2237" },
    "&Proportional;": { "codepoints": [8733], "characters": "\u221D" },
    "&Pscr;": { "codepoints": [119979], "characters": "\uD835\uDCAB" },
    "&Psi;": { "codepoints": [936], "characters": "\u03A8" },
    "&QUOT": { "codepoints": [34], "characters": "\u0022" },
    "&QUOT;": { "codepoints": [34], "characters": "\u0022" },
    "&Qfr;": { "codepoints": [120084], "characters": "\uD835\uDD14" },
    "&Qopf;": { "codepoints": [8474], "characters": "\u211A" },
    "&Qscr;": { "codepoints": [119980], "characters": "\uD835\uDCAC" },
    "&RBarr;": { "codepoints": [10512], "characters": "\u2910" },
    "&REG": { "codepoints": [174], "characters": "\u00AE" },
    "&REG;": { "codepoints": [174], "characters": "\u00AE" },
    "&Racute;": { "codepoints": [340], "characters": "\u0154" },
    "&Rang;": { "codepoints": [10219], "characters": "\u27EB" },
    "&Rarr;": { "codepoints": [8608], "characters": "\u21A0" },
    "&Rarrtl;": { "codepoints": [10518], "characters": "\u2916" },
    "&Rcaron;": { "codepoints": [344], "characters": "\u0158" },
    "&Rcedil;": { "codepoints": [342], "characters": "\u0156" },
    "&Rcy;": { "codepoints": [1056], "characters": "\u0420" },
    "&Re;": { "codepoints": [8476], "characters": "\u211C" },
    "&ReverseElement;": { "codepoints": [8715], "characters": "\u220B" },
    "&ReverseEquilibrium;": { "codepoints": [8651], "characters": "\u21CB" },
    "&ReverseUpEquilibrium;": { "codepoints": [10607], "characters": "\u296F" },
    "&Rfr;": { "codepoints": [8476], "characters": "\u211C" },
    "&Rho;": { "codepoints": [929], "characters": "\u03A1" },
    "&RightAngleBracket;": { "codepoints": [10217], "characters": "\u27E9" },
    "&RightArrow;": { "codepoints": [8594], "characters": "\u2192" },
    "&RightArrowBar;": { "codepoints": [8677], "characters": "\u21E5" },
    "&RightArrowLeftArrow;": { "codepoints": [8644], "characters": "\u21C4" },
    "&RightCeiling;": { "codepoints": [8969], "characters": "\u2309" },
    "&RightDoubleBracket;": { "codepoints": [10215], "characters": "\u27E7" },
    "&RightDownTeeVector;": { "codepoints": [10589], "characters": "\u295D" },
    "&RightDownVector;": { "codepoints": [8642], "characters": "\u21C2" },
    "&RightDownVectorBar;": { "codepoints": [10581], "characters": "\u2955" },
    "&RightFloor;": { "codepoints": [8971], "characters": "\u230B" },
    "&RightTee;": { "codepoints": [8866], "characters": "\u22A2" },
    "&RightTeeArrow;": { "codepoints": [8614], "characters": "\u21A6" },
    "&RightTeeVector;": { "codepoints": [10587], "characters": "\u295B" },
    "&RightTriangle;": { "codepoints": [8883], "characters": "\u22B3" },
    "&RightTriangleBar;": { "codepoints": [10704], "characters": "\u29D0" },
    "&RightTriangleEqual;": { "codepoints": [8885], "characters": "\u22B5" },
    "&RightUpDownVector;": { "codepoints": [10575], "characters": "\u294F" },
    "&RightUpTeeVector;": { "codepoints": [10588], "characters": "\u295C" },
    "&RightUpVector;": { "codepoints": [8638], "characters": "\u21BE" },
    "&RightUpVectorBar;": { "codepoints": [10580], "characters": "\u2954" },
    "&RightVector;": { "codepoints": [8640], "characters": "\u21C0" },
    "&RightVectorBar;": { "codepoints": [10579], "characters": "\u2953" },
    "&Rightarrow;": { "codepoints": [8658], "characters": "\u21D2" },
    "&Ropf;": { "codepoints": [8477], "characters": "\u211D" },
    "&RoundImplies;": { "codepoints": [10608], "characters": "\u2970" },
    "&Rrightarrow;": { "codepoints": [8667], "characters": "\u21DB" },
    "&Rscr;": { "codepoints": [8475], "characters": "\u211B" },
    "&Rsh;": { "codepoints": [8625], "characters": "\u21B1" },
    "&RuleDelayed;": { "codepoints": [10740], "characters": "\u29F4" },
    "&SHCHcy;": { "codepoints": [1065], "characters": "\u0429" },
    "&SHcy;": { "codepoints": [1064], "characters": "\u0428" },
    "&SOFTcy;": { "codepoints": [1068], "characters": "\u042C" },
    "&Sacute;": { "codepoints": [346], "characters": "\u015A" },
    "&Sc;": { "codepoints": [10940], "characters": "\u2ABC" },
    "&Scaron;": { "codepoints": [352], "characters": "\u0160" },
    "&Scedil;": { "codepoints": [350], "characters": "\u015E" },
    "&Scirc;": { "codepoints": [348], "characters": "\u015C" },
    "&Scy;": { "codepoints": [1057], "characters": "\u0421" },
    "&Sfr;": { "codepoints": [120086], "characters": "\uD835\uDD16" },
    "&ShortDownArrow;": { "codepoints": [8595], "characters": "\u2193" },
    "&ShortLeftArrow;": { "codepoints": [8592], "characters": "\u2190" },
    "&ShortRightArrow;": { "codepoints": [8594], "characters": "\u2192" },
    "&ShortUpArrow;": { "codepoints": [8593], "characters": "\u2191" },
    "&Sigma;": { "codepoints": [931], "characters": "\u03A3" },
    "&SmallCircle;": { "codepoints": [8728], "characters": "\u2218" },
    "&Sopf;": { "codepoints": [120138], "characters": "\uD835\uDD4A" },
    "&Sqrt;": { "codepoints": [8730], "characters": "\u221A" },
    "&Square;": { "codepoints": [9633], "characters": "\u25A1" },
    "&SquareIntersection;": { "codepoints": [8851], "characters": "\u2293" },
    "&SquareSubset;": { "codepoints": [8847], "characters": "\u228F" },
    "&SquareSubsetEqual;": { "codepoints": [8849], "characters": "\u2291" },
    "&SquareSuperset;": { "codepoints": [8848], "characters": "\u2290" },
    "&SquareSupersetEqual;": { "codepoints": [8850], "characters": "\u2292" },
    "&SquareUnion;": { "codepoints": [8852], "characters": "\u2294" },
    "&Sscr;": { "codepoints": [119982], "characters": "\uD835\uDCAE" },
    "&Star;": { "codepoints": [8902], "characters": "\u22C6" },
    "&Sub;": { "codepoints": [8912], "characters": "\u22D0" },
    "&Subset;": { "codepoints": [8912], "characters": "\u22D0" },
    "&SubsetEqual;": { "codepoints": [8838], "characters": "\u2286" },
    "&Succeeds;": { "codepoints": [8827], "characters": "\u227B" },
    "&SucceedsEqual;": { "codepoints": [10928], "characters": "\u2AB0" },
    "&SucceedsSlantEqual;": { "codepoints": [8829], "characters": "\u227D" },
    "&SucceedsTilde;": { "codepoints": [8831], "characters": "\u227F" },
    "&SuchThat;": { "codepoints": [8715], "characters": "\u220B" },
    "&Sum;": { "codepoints": [8721], "characters": "\u2211" },
    "&Sup;": { "codepoints": [8913], "characters": "\u22D1" },
    "&Superset;": { "codepoints": [8835], "characters": "\u2283" },
    "&SupersetEqual;": { "codepoints": [8839], "characters": "\u2287" },
    "&Supset;": { "codepoints": [8913], "characters": "\u22D1" },
    "&THORN": { "codepoints": [222], "characters": "\u00DE" },
    "&THORN;": { "codepoints": [222], "characters": "\u00DE" },
    "&TRADE;": { "codepoints": [8482], "characters": "\u2122" },
    "&TSHcy;": { "codepoints": [1035], "characters": "\u040B" },
    "&TScy;": { "codepoints": [1062], "characters": "\u0426" },
    "&Tab;": { "codepoints": [9], "characters": "\u0009" },
    "&Tau;": { "codepoints": [932], "characters": "\u03A4" },
    "&Tcaron;": { "codepoints": [356], "characters": "\u0164" },
    "&Tcedil;": { "codepoints": [354], "characters": "\u0162" },
    "&Tcy;": { "codepoints": [1058], "characters": "\u0422" },
    "&Tfr;": { "codepoints": [120087], "characters": "\uD835\uDD17" },
    "&Therefore;": { "codepoints": [8756], "characters": "\u2234" },
    "&Theta;": { "codepoints": [920], "characters": "\u0398" },
    "&ThickSpace;": { "codepoints": [8287, 8202], "characters": "\u205F\u200A" },
    "&ThinSpace;": { "codepoints": [8201], "characters": "\u2009" },
    "&Tilde;": { "codepoints": [8764], "characters": "\u223C" },
    "&TildeEqual;": { "codepoints": [8771], "characters": "\u2243" },
    "&TildeFullEqual;": { "codepoints": [8773], "characters": "\u2245" },
    "&TildeTilde;": { "codepoints": [8776], "characters": "\u2248" },
    "&Topf;": { "codepoints": [120139], "characters": "\uD835\uDD4B" },
    "&TripleDot;": { "codepoints": [8411], "characters": "\u20DB" },
    "&Tscr;": { "codepoints": [119983], "characters": "\uD835\uDCAF" },
    "&Tstrok;": { "codepoints": [358], "characters": "\u0166" },
    "&Uacute": { "codepoints": [218], "characters": "\u00DA" },
    "&Uacute;": { "codepoints": [218], "characters": "\u00DA" },
    "&Uarr;": { "codepoints": [8607], "characters": "\u219F" },
    "&Uarrocir;": { "codepoints": [10569], "characters": "\u2949" },
    "&Ubrcy;": { "codepoints": [1038], "characters": "\u040E" },
    "&Ubreve;": { "codepoints": [364], "characters": "\u016C" },
    "&Ucirc": { "codepoints": [219], "characters": "\u00DB" },
    "&Ucirc;": { "codepoints": [219], "characters": "\u00DB" },
    "&Ucy;": { "codepoints": [1059], "characters": "\u0423" },
    "&Udblac;": { "codepoints": [368], "characters": "\u0170" },
    "&Ufr;": { "codepoints": [120088], "characters": "\uD835\uDD18" },
    "&Ugrave": { "codepoints": [217], "characters": "\u00D9" },
    "&Ugrave;": { "codepoints": [217], "characters": "\u00D9" },
    "&Umacr;": { "codepoints": [362], "characters": "\u016A" },
    "&UnderBar;": { "codepoints": [95], "characters": "\u005F" },
    "&UnderBrace;": { "codepoints": [9183], "characters": "\u23DF" },
    "&UnderBracket;": { "codepoints": [9141], "characters": "\u23B5" },
    "&UnderParenthesis;": { "codepoints": [9181], "characters": "\u23DD" },
    "&Union;": { "codepoints": [8899], "characters": "\u22C3" },
    "&UnionPlus;": { "codepoints": [8846], "characters": "\u228E" },
    "&Uogon;": { "codepoints": [370], "characters": "\u0172" },
    "&Uopf;": { "codepoints": [120140], "characters": "\uD835\uDD4C" },
    "&UpArrow;": { "codepoints": [8593], "characters": "\u2191" },
    "&UpArrowBar;": { "codepoints": [10514], "characters": "\u2912" },
    "&UpArrowDownArrow;": { "codepoints": [8645], "characters": "\u21C5" },
    "&UpDownArrow;": { "codepoints": [8597], "characters": "\u2195" },
    "&UpEquilibrium;": { "codepoints": [10606], "characters": "\u296E" },
    "&UpTee;": { "codepoints": [8869], "characters": "\u22A5" },
    "&UpTeeArrow;": { "codepoints": [8613], "characters": "\u21A5" },
    "&Uparrow;": { "codepoints": [8657], "characters": "\u21D1" },
    "&Updownarrow;": { "codepoints": [8661], "characters": "\u21D5" },
    "&UpperLeftArrow;": { "codepoints": [8598], "characters": "\u2196" },
    "&UpperRightArrow;": { "codepoints": [8599], "characters": "\u2197" },
    "&Upsi;": { "codepoints": [978], "characters": "\u03D2" },
    "&Upsilon;": { "codepoints": [933], "characters": "\u03A5" },
    "&Uring;": { "codepoints": [366], "characters": "\u016E" },
    "&Uscr;": { "codepoints": [119984], "characters": "\uD835\uDCB0" },
    "&Utilde;": { "codepoints": [360], "characters": "\u0168" },
    "&Uuml": { "codepoints": [220], "characters": "\u00DC" },
    "&Uuml;": { "codepoints": [220], "characters": "\u00DC" },
    "&VDash;": { "codepoints": [8875], "characters": "\u22AB" },
    "&Vbar;": { "codepoints": [10987], "characters": "\u2AEB" },
    "&Vcy;": { "codepoints": [1042], "characters": "\u0412" },
    "&Vdash;": { "codepoints": [8873], "characters": "\u22A9" },
    "&Vdashl;": { "codepoints": [10982], "characters": "\u2AE6" },
    "&Vee;": { "codepoints": [8897], "characters": "\u22C1" },
    "&Verbar;": { "codepoints": [8214], "characters": "\u2016" },
    "&Vert;": { "codepoints": [8214], "characters": "\u2016" },
    "&VerticalBar;": { "codepoints": [8739], "characters": "\u2223" },
    "&VerticalLine;": { "codepoints": [124], "characters": "\u007C" },
    "&VerticalSeparator;": { "codepoints": [10072], "characters": "\u2758" },
    "&VerticalTilde;": { "codepoints": [8768], "characters": "\u2240" },
    "&VeryThinSpace;": { "codepoints": [8202], "characters": "\u200A" },
    "&Vfr;": { "codepoints": [120089], "characters": "\uD835\uDD19" },
    "&Vopf;": { "codepoints": [120141], "characters": "\uD835\uDD4D" },
    "&Vscr;": { "codepoints": [119985], "characters": "\uD835\uDCB1" },
    "&Vvdash;": { "codepoints": [8874], "characters": "\u22AA" },
    "&Wcirc;": { "codepoints": [372], "characters": "\u0174" },
    "&Wedge;": { "codepoints": [8896], "characters": "\u22C0" },
    "&Wfr;": { "codepoints": [120090], "characters": "\uD835\uDD1A" },
    "&Wopf;": { "codepoints": [120142], "characters": "\uD835\uDD4E" },
    "&Wscr;": { "codepoints": [119986], "characters": "\uD835\uDCB2" },
    "&Xfr;": { "codepoints": [120091], "characters": "\uD835\uDD1B" },
    "&Xi;": { "codepoints": [926], "characters": "\u039E" },
    "&Xopf;": { "codepoints": [120143], "characters": "\uD835\uDD4F" },
    "&Xscr;": { "codepoints": [119987], "characters": "\uD835\uDCB3" },
    "&YAcy;": { "codepoints": [1071], "characters": "\u042F" },
    "&YIcy;": { "codepoints": [1031], "characters": "\u0407" },
    "&YUcy;": { "codepoints": [1070], "characters": "\u042E" },
    "&Yacute": { "codepoints": [221], "characters": "\u00DD" },
    "&Yacute;": { "codepoints": [221], "characters": "\u00DD" },
    "&Ycirc;": { "codepoints": [374], "characters": "\u0176" },
    "&Ycy;": { "codepoints": [1067], "characters": "\u042B" },
    "&Yfr;": { "codepoints": [120092], "characters": "\uD835\uDD1C" },
    "&Yopf;": { "codepoints": [120144], "characters": "\uD835\uDD50" },
    "&Yscr;": { "codepoints": [119988], "characters": "\uD835\uDCB4" },
    "&Yuml;": { "codepoints": [376], "characters": "\u0178" },
    "&ZHcy;": { "codepoints": [1046], "characters": "\u0416" },
    "&Zacute;": { "codepoints": [377], "characters": "\u0179" },
    "&Zcaron;": { "codepoints": [381], "characters": "\u017D" },
    "&Zcy;": { "codepoints": [1047], "characters": "\u0417" },
    "&Zdot;": { "codepoints": [379], "characters": "\u017B" },
    "&ZeroWidthSpace;": { "codepoints": [8203], "characters": "\u200B" },
    "&Zeta;": { "codepoints": [918], "characters": "\u0396" },
    "&Zfr;": { "codepoints": [8488], "characters": "\u2128" },
    "&Zopf;": { "codepoints": [8484], "characters": "\u2124" },
    "&Zscr;": { "codepoints": [119989], "characters": "\uD835\uDCB5" },
    "&aacute": { "codepoints": [225], "characters": "\u00E1" },
    "&aacute;": { "codepoints": [225], "characters": "\u00E1" },
    "&abreve;": { "codepoints": [259], "characters": "\u0103" },
    "&ac;": { "codepoints": [8766], "characters": "\u223E" },
    "&acE;": { "codepoints": [8766, 819], "characters": "\u223E\u0333" },
    "&acd;": { "codepoints": [8767], "characters": "\u223F" },
    "&acirc": { "codepoints": [226], "characters": "\u00E2" },
    "&acirc;": { "codepoints": [226], "characters": "\u00E2" },
    "&acute": { "codepoints": [180], "characters": "\u00B4" },
    "&acute;": { "codepoints": [180], "characters": "\u00B4" },
    "&acy;": { "codepoints": [1072], "characters": "\u0430" },
    "&aelig": { "codepoints": [230], "characters": "\u00E6" },
    "&aelig;": { "codepoints": [230], "characters": "\u00E6" },
    "&af;": { "codepoints": [8289], "characters": "\u2061" },
    "&afr;": { "codepoints": [120094], "characters": "\uD835\uDD1E" },
    "&agrave": { "codepoints": [224], "characters": "\u00E0" },
    "&agrave;": { "codepoints": [224], "characters": "\u00E0" },
    "&alefsym;": { "codepoints": [8501], "characters": "\u2135" },
    "&aleph;": { "codepoints": [8501], "characters": "\u2135" },
    "&alpha;": { "codepoints": [945], "characters": "\u03B1" },
    "&amacr;": { "codepoints": [257], "characters": "\u0101" },
    "&amalg;": { "codepoints": [10815], "characters": "\u2A3F" },
    "&amp": { "codepoints": [38], "characters": "\u0026" },
    "&amp;": { "codepoints": [38], "characters": "\u0026" },
    "&and;": { "codepoints": [8743], "characters": "\u2227" },
    "&andand;": { "codepoints": [10837], "characters": "\u2A55" },
    "&andd;": { "codepoints": [10844], "characters": "\u2A5C" },
    "&andslope;": { "codepoints": [10840], "characters": "\u2A58" },
    "&andv;": { "codepoints": [10842], "characters": "\u2A5A" },
    "&ang;": { "codepoints": [8736], "characters": "\u2220" },
    "&ange;": { "codepoints": [10660], "characters": "\u29A4" },
    "&angle;": { "codepoints": [8736], "characters": "\u2220" },
    "&angmsd;": { "codepoints": [8737], "characters": "\u2221" },
    "&angmsdaa;": { "codepoints": [10664], "characters": "\u29A8" },
    "&angmsdab;": { "codepoints": [10665], "characters": "\u29A9" },
    "&angmsdac;": { "codepoints": [10666], "characters": "\u29AA" },
    "&angmsdad;": { "codepoints": [10667], "characters": "\u29AB" },
    "&angmsdae;": { "codepoints": [10668], "characters": "\u29AC" },
    "&angmsdaf;": { "codepoints": [10669], "characters": "\u29AD" },
    "&angmsdag;": { "codepoints": [10670], "characters": "\u29AE" },
    "&angmsdah;": { "codepoints": [10671], "characters": "\u29AF" },
    "&angrt;": { "codepoints": [8735], "characters": "\u221F" },
    "&angrtvb;": { "codepoints": [8894], "characters": "\u22BE" },
    "&angrtvbd;": { "codepoints": [10653], "characters": "\u299D" },
    "&angsph;": { "codepoints": [8738], "characters": "\u2222" },
    "&angst;": { "codepoints": [197], "characters": "\u00C5" },
    "&angzarr;": { "codepoints": [9084], "characters": "\u237C" },
    "&aogon;": { "codepoints": [261], "characters": "\u0105" },
    "&aopf;": { "codepoints": [120146], "characters": "\uD835\uDD52" },
    "&ap;": { "codepoints": [8776], "characters": "\u2248" },
    "&apE;": { "codepoints": [10864], "characters": "\u2A70" },
    "&apacir;": { "codepoints": [10863], "characters": "\u2A6F" },
    "&ape;": { "codepoints": [8778], "characters": "\u224A" },
    "&apid;": { "codepoints": [8779], "characters": "\u224B" },
    "&apos;": { "codepoints": [39], "characters": "\u0027" },
    "&approx;": { "codepoints": [8776], "characters": "\u2248" },
    "&approxeq;": { "codepoints": [8778], "characters": "\u224A" },
    "&aring": { "codepoints": [229], "characters": "\u00E5" },
    "&aring;": { "codepoints": [229], "characters": "\u00E5" },
    "&ascr;": { "codepoints": [119990], "characters": "\uD835\uDCB6" },
    "&ast;": { "codepoints": [42], "characters": "\u002A" },
    "&asymp;": { "codepoints": [8776], "characters": "\u2248" },
    "&asympeq;": { "codepoints": [8781], "characters": "\u224D" },
    "&atilde": { "codepoints": [227], "characters": "\u00E3" },
    "&atilde;": { "codepoints": [227], "characters": "\u00E3" },
    "&auml": { "codepoints": [228], "characters": "\u00E4" },
    "&auml;": { "codepoints": [228], "characters": "\u00E4" },
    "&awconint;": { "codepoints": [8755], "characters": "\u2233" },
    "&awint;": { "codepoints": [10769], "characters": "\u2A11" },
    "&bNot;": { "codepoints": [10989], "characters": "\u2AED" },
    "&backcong;": { "codepoints": [8780], "characters": "\u224C" },
    "&backepsilon;": { "codepoints": [1014], "characters": "\u03F6" },
    "&backprime;": { "codepoints": [8245], "characters": "\u2035" },
    "&backsim;": { "codepoints": [8765], "characters": "\u223D" },
    "&backsimeq;": { "codepoints": [8909], "characters": "\u22CD" },
    "&barvee;": { "codepoints": [8893], "characters": "\u22BD" },
    "&barwed;": { "codepoints": [8965], "characters": "\u2305" },
    "&barwedge;": { "codepoints": [8965], "characters": "\u2305" },
    "&bbrk;": { "codepoints": [9141], "characters": "\u23B5" },
    "&bbrktbrk;": { "codepoints": [9142], "characters": "\u23B6" },
    "&bcong;": { "codepoints": [8780], "characters": "\u224C" },
    "&bcy;": { "codepoints": [1073], "characters": "\u0431" },
    "&bdquo;": { "codepoints": [8222], "characters": "\u201E" },
    "&becaus;": { "codepoints": [8757], "characters": "\u2235" },
    "&because;": { "codepoints": [8757], "characters": "\u2235" },
    "&bemptyv;": { "codepoints": [10672], "characters": "\u29B0" },
    "&bepsi;": { "codepoints": [1014], "characters": "\u03F6" },
    "&bernou;": { "codepoints": [8492], "characters": "\u212C" },
    "&beta;": { "codepoints": [946], "characters": "\u03B2" },
    "&beth;": { "codepoints": [8502], "characters": "\u2136" },
    "&between;": { "codepoints": [8812], "characters": "\u226C" },
    "&bfr;": { "codepoints": [120095], "characters": "\uD835\uDD1F" },
    "&bigcap;": { "codepoints": [8898], "characters": "\u22C2" },
    "&bigcirc;": { "codepoints": [9711], "characters": "\u25EF" },
    "&bigcup;": { "codepoints": [8899], "characters": "\u22C3" },
    "&bigodot;": { "codepoints": [10752], "characters": "\u2A00" },
    "&bigoplus;": { "codepoints": [10753], "characters": "\u2A01" },
    "&bigotimes;": { "codepoints": [10754], "characters": "\u2A02" },
    "&bigsqcup;": { "codepoints": [10758], "characters": "\u2A06" },
    "&bigstar;": { "codepoints": [9733], "characters": "\u2605" },
    "&bigtriangledown;": { "codepoints": [9661], "characters": "\u25BD" },
    "&bigtriangleup;": { "codepoints": [9651], "characters": "\u25B3" },
    "&biguplus;": { "codepoints": [10756], "characters": "\u2A04" },
    "&bigvee;": { "codepoints": [8897], "characters": "\u22C1" },
    "&bigwedge;": { "codepoints": [8896], "characters": "\u22C0" },
    "&bkarow;": { "codepoints": [10509], "characters": "\u290D" },
    "&blacklozenge;": { "codepoints": [10731], "characters": "\u29EB" },
    "&blacksquare;": { "codepoints": [9642], "characters": "\u25AA" },
    "&blacktriangle;": { "codepoints": [9652], "characters": "\u25B4" },
    "&blacktriangledown;": { "codepoints": [9662], "characters": "\u25BE" },
    "&blacktriangleleft;": { "codepoints": [9666], "characters": "\u25C2" },
    "&blacktriangleright;": { "codepoints": [9656], "characters": "\u25B8" },
    "&blank;": { "codepoints": [9251], "characters": "\u2423" },
    "&blk12;": { "codepoints": [9618], "characters": "\u2592" },
    "&blk14;": { "codepoints": [9617], "characters": "\u2591" },
    "&blk34;": { "codepoints": [9619], "characters": "\u2593" },
    "&block;": { "codepoints": [9608], "characters": "\u2588" },
    "&bne;": { "codepoints": [61, 8421], "characters": "\u003D\u20E5" },
    "&bnequiv;": { "codepoints": [8801, 8421], "characters": "\u2261\u20E5" },
    "&bnot;": { "codepoints": [8976], "characters": "\u2310" },
    "&bopf;": { "codepoints": [120147], "characters": "\uD835\uDD53" },
    "&bot;": { "codepoints": [8869], "characters": "\u22A5" },
    "&bottom;": { "codepoints": [8869], "characters": "\u22A5" },
    "&bowtie;": { "codepoints": [8904], "characters": "\u22C8" },
    "&boxDL;": { "codepoints": [9559], "characters": "\u2557" },
    "&boxDR;": { "codepoints": [9556], "characters": "\u2554" },
    "&boxDl;": { "codepoints": [9558], "characters": "\u2556" },
    "&boxDr;": { "codepoints": [9555], "characters": "\u2553" },
    "&boxH;": { "codepoints": [9552], "characters": "\u2550" },
    "&boxHD;": { "codepoints": [9574], "characters": "\u2566" },
    "&boxHU;": { "codepoints": [9577], "characters": "\u2569" },
    "&boxHd;": { "codepoints": [9572], "characters": "\u2564" },
    "&boxHu;": { "codepoints": [9575], "characters": "\u2567" },
    "&boxUL;": { "codepoints": [9565], "characters": "\u255D" },
    "&boxUR;": { "codepoints": [9562], "characters": "\u255A" },
    "&boxUl;": { "codepoints": [9564], "characters": "\u255C" },
    "&boxUr;": { "codepoints": [9561], "characters": "\u2559" },
    "&boxV;": { "codepoints": [9553], "characters": "\u2551" },
    "&boxVH;": { "codepoints": [9580], "characters": "\u256C" },
    "&boxVL;": { "codepoints": [9571], "characters": "\u2563" },
    "&boxVR;": { "codepoints": [9568], "characters": "\u2560" },
    "&boxVh;": { "codepoints": [9579], "characters": "\u256B" },
    "&boxVl;": { "codepoints": [9570], "characters": "\u2562" },
    "&boxVr;": { "codepoints": [9567], "characters": "\u255F" },
    "&boxbox;": { "codepoints": [10697], "characters": "\u29C9" },
    "&boxdL;": { "codepoints": [9557], "characters": "\u2555" },
    "&boxdR;": { "codepoints": [9554], "characters": "\u2552" },
    "&boxdl;": { "codepoints": [9488], "characters": "\u2510" },
    "&boxdr;": { "codepoints": [9484], "characters": "\u250C" },
    "&boxh;": { "codepoints": [9472], "characters": "\u2500" },
    "&boxhD;": { "codepoints": [9573], "characters": "\u2565" },
    "&boxhU;": { "codepoints": [9576], "characters": "\u2568" },
    "&boxhd;": { "codepoints": [9516], "characters": "\u252C" },
    "&boxhu;": { "codepoints": [9524], "characters": "\u2534" },
    "&boxminus;": { "codepoints": [8863], "characters": "\u229F" },
    "&boxplus;": { "codepoints": [8862], "characters": "\u229E" },
    "&boxtimes;": { "codepoints": [8864], "characters": "\u22A0" },
    "&boxuL;": { "codepoints": [9563], "characters": "\u255B" },
    "&boxuR;": { "codepoints": [9560], "characters": "\u2558" },
    "&boxul;": { "codepoints": [9496], "characters": "\u2518" },
    "&boxur;": { "codepoints": [9492], "characters": "\u2514" },
    "&boxv;": { "codepoints": [9474], "characters": "\u2502" },
    "&boxvH;": { "codepoints": [9578], "characters": "\u256A" },
    "&boxvL;": { "codepoints": [9569], "characters": "\u2561" },
    "&boxvR;": { "codepoints": [9566], "characters": "\u255E" },
    "&boxvh;": { "codepoints": [9532], "characters": "\u253C" },
    "&boxvl;": { "codepoints": [9508], "characters": "\u2524" },
    "&boxvr;": { "codepoints": [9500], "characters": "\u251C" },
    "&bprime;": { "codepoints": [8245], "characters": "\u2035" },
    "&breve;": { "codepoints": [728], "characters": "\u02D8" },
    "&brvbar": { "codepoints": [166], "characters": "\u00A6" },
    "&brvbar;": { "codepoints": [166], "characters": "\u00A6" },
    "&bscr;": { "codepoints": [119991], "characters": "\uD835\uDCB7" },
    "&bsemi;": { "codepoints": [8271], "characters": "\u204F" },
    "&bsim;": { "codepoints": [8765], "characters": "\u223D" },
    "&bsime;": { "codepoints": [8909], "characters": "\u22CD" },
    "&bsol;": { "codepoints": [92], "characters": "\u005C" },
    "&bsolb;": { "codepoints": [10693], "characters": "\u29C5" },
    "&bsolhsub;": { "codepoints": [10184], "characters": "\u27C8" },
    "&bull;": { "codepoints": [8226], "characters": "\u2022" },
    "&bullet;": { "codepoints": [8226], "characters": "\u2022" },
    "&bump;": { "codepoints": [8782], "characters": "\u224E" },
    "&bumpE;": { "codepoints": [10926], "characters": "\u2AAE" },
    "&bumpe;": { "codepoints": [8783], "characters": "\u224F" },
    "&bumpeq;": { "codepoints": [8783], "characters": "\u224F" },
    "&cacute;": { "codepoints": [263], "characters": "\u0107" },
    "&cap;": { "codepoints": [8745], "characters": "\u2229" },
    "&capand;": { "codepoints": [10820], "characters": "\u2A44" },
    "&capbrcup;": { "codepoints": [10825], "characters": "\u2A49" },
    "&capcap;": { "codepoints": [10827], "characters": "\u2A4B" },
    "&capcup;": { "codepoints": [10823], "characters": "\u2A47" },
    "&capdot;": { "codepoints": [10816], "characters": "\u2A40" },
    "&caps;": { "codepoints": [8745, 65024], "characters": "\u2229\uFE00" },
    "&caret;": { "codepoints": [8257], "characters": "\u2041" },
    "&caron;": { "codepoints": [711], "characters": "\u02C7" },
    "&ccaps;": { "codepoints": [10829], "characters": "\u2A4D" },
    "&ccaron;": { "codepoints": [269], "characters": "\u010D" },
    "&ccedil": { "codepoints": [231], "characters": "\u00E7" },
    "&ccedil;": { "codepoints": [231], "characters": "\u00E7" },
    "&ccirc;": { "codepoints": [265], "characters": "\u0109" },
    "&ccups;": { "codepoints": [10828], "characters": "\u2A4C" },
    "&ccupssm;": { "codepoints": [10832], "characters": "\u2A50" },
    "&cdot;": { "codepoints": [267], "characters": "\u010B" },
    "&cedil": { "codepoints": [184], "characters": "\u00B8" },
    "&cedil;": { "codepoints": [184], "characters": "\u00B8" },
    "&cemptyv;": { "codepoints": [10674], "characters": "\u29B2" },
    "&cent": { "codepoints": [162], "characters": "\u00A2" },
    "&cent;": { "codepoints": [162], "characters": "\u00A2" },
    "&centerdot;": { "codepoints": [183], "characters": "\u00B7" },
    "&cfr;": { "codepoints": [120096], "characters": "\uD835\uDD20" },
    "&chcy;": { "codepoints": [1095], "characters": "\u0447" },
    "&check;": { "codepoints": [10003], "characters": "\u2713" },
    "&checkmark;": { "codepoints": [10003], "characters": "\u2713" },
    "&chi;": { "codepoints": [967], "characters": "\u03C7" },
    "&cir;": { "codepoints": [9675], "characters": "\u25CB" },
    "&cirE;": { "codepoints": [10691], "characters": "\u29C3" },
    "&circ;": { "codepoints": [710], "characters": "\u02C6" },
    "&circeq;": { "codepoints": [8791], "characters": "\u2257" },
    "&circlearrowleft;": { "codepoints": [8634], "characters": "\u21BA" },
    "&circlearrowright;": { "codepoints": [8635], "characters": "\u21BB" },
    "&circledR;": { "codepoints": [174], "characters": "\u00AE" },
    "&circledS;": { "codepoints": [9416], "characters": "\u24C8" },
    "&circledast;": { "codepoints": [8859], "characters": "\u229B" },
    "&circledcirc;": { "codepoints": [8858], "characters": "\u229A" },
    "&circleddash;": { "codepoints": [8861], "characters": "\u229D" },
    "&cire;": { "codepoints": [8791], "characters": "\u2257" },
    "&cirfnint;": { "codepoints": [10768], "characters": "\u2A10" },
    "&cirmid;": { "codepoints": [10991], "characters": "\u2AEF" },
    "&cirscir;": { "codepoints": [10690], "characters": "\u29C2" },
    "&clubs;": { "codepoints": [9827], "characters": "\u2663" },
    "&clubsuit;": { "codepoints": [9827], "characters": "\u2663" },
    "&colon;": { "codepoints": [58], "characters": "\u003A" },
    "&colone;": { "codepoints": [8788], "characters": "\u2254" },
    "&coloneq;": { "codepoints": [8788], "characters": "\u2254" },
    "&comma;": { "codepoints": [44], "characters": "\u002C" },
    "&commat;": { "codepoints": [64], "characters": "\u0040" },
    "&comp;": { "codepoints": [8705], "characters": "\u2201" },
    "&compfn;": { "codepoints": [8728], "characters": "\u2218" },
    "&complement;": { "codepoints": [8705], "characters": "\u2201" },
    "&complexes;": { "codepoints": [8450], "characters": "\u2102" },
    "&cong;": { "codepoints": [8773], "characters": "\u2245" },
    "&congdot;": { "codepoints": [10861], "characters": "\u2A6D" },
    "&conint;": { "codepoints": [8750], "characters": "\u222E" },
    "&copf;": { "codepoints": [120148], "characters": "\uD835\uDD54" },
    "&coprod;": { "codepoints": [8720], "characters": "\u2210" },
    "&copy": { "codepoints": [169], "characters": "\u00A9" },
    "&copy;": { "codepoints": [169], "characters": "\u00A9" },
    "&copysr;": { "codepoints": [8471], "characters": "\u2117" },
    "&crarr;": { "codepoints": [8629], "characters": "\u21B5" },
    "&cross;": { "codepoints": [10007], "characters": "\u2717" },
    "&cscr;": { "codepoints": [119992], "characters": "\uD835\uDCB8" },
    "&csub;": { "codepoints": [10959], "characters": "\u2ACF" },
    "&csube;": { "codepoints": [10961], "characters": "\u2AD1" },
    "&csup;": { "codepoints": [10960], "characters": "\u2AD0" },
    "&csupe;": { "codepoints": [10962], "characters": "\u2AD2" },
    "&ctdot;": { "codepoints": [8943], "characters": "\u22EF" },
    "&cudarrl;": { "codepoints": [10552], "characters": "\u2938" },
    "&cudarrr;": { "codepoints": [10549], "characters": "\u2935" },
    "&cuepr;": { "codepoints": [8926], "characters": "\u22DE" },
    "&cuesc;": { "codepoints": [8927], "characters": "\u22DF" },
    "&cularr;": { "codepoints": [8630], "characters": "\u21B6" },
    "&cularrp;": { "codepoints": [10557], "characters": "\u293D" },
    "&cup;": { "codepoints": [8746], "characters": "\u222A" },
    "&cupbrcap;": { "codepoints": [10824], "characters": "\u2A48" },
    "&cupcap;": { "codepoints": [10822], "characters": "\u2A46" },
    "&cupcup;": { "codepoints": [10826], "characters": "\u2A4A" },
    "&cupdot;": { "codepoints": [8845], "characters": "\u228D" },
    "&cupor;": { "codepoints": [10821], "characters": "\u2A45" },
    "&cups;": { "codepoints": [8746, 65024], "characters": "\u222A\uFE00" },
    "&curarr;": { "codepoints": [8631], "characters": "\u21B7" },
    "&curarrm;": { "codepoints": [10556], "characters": "\u293C" },
    "&curlyeqprec;": { "codepoints": [8926], "characters": "\u22DE" },
    "&curlyeqsucc;": { "codepoints": [8927], "characters": "\u22DF" },
    "&curlyvee;": { "codepoints": [8910], "characters": "\u22CE" },
    "&curlywedge;": { "codepoints": [8911], "characters": "\u22CF" },
    "&curren": { "codepoints": [164], "characters": "\u00A4" },
    "&curren;": { "codepoints": [164], "characters": "\u00A4" },
    "&curvearrowleft;": { "codepoints": [8630], "characters": "\u21B6" },
    "&curvearrowright;": { "codepoints": [8631], "characters": "\u21B7" },
    "&cuvee;": { "codepoints": [8910], "characters": "\u22CE" },
    "&cuwed;": { "codepoints": [8911], "characters": "\u22CF" },
    "&cwconint;": { "codepoints": [8754], "characters": "\u2232" },
    "&cwint;": { "codepoints": [8753], "characters": "\u2231" },
    "&cylcty;": { "codepoints": [9005], "characters": "\u232D" },
    "&dArr;": { "codepoints": [8659], "characters": "\u21D3" },
    "&dHar;": { "codepoints": [10597], "characters": "\u2965" },
    "&dagger;": { "codepoints": [8224], "characters": "\u2020" },
    "&daleth;": { "codepoints": [8504], "characters": "\u2138" },
    "&darr;": { "codepoints": [8595], "characters": "\u2193" },
    "&dash;": { "codepoints": [8208], "characters": "\u2010" },
    "&dashv;": { "codepoints": [8867], "characters": "\u22A3" },
    "&dbkarow;": { "codepoints": [10511], "characters": "\u290F" },
    "&dblac;": { "codepoints": [733], "characters": "\u02DD" },
    "&dcaron;": { "codepoints": [271], "characters": "\u010F" },
    "&dcy;": { "codepoints": [1076], "characters": "\u0434" },
    "&dd;": { "codepoints": [8518], "characters": "\u2146" },
    "&ddagger;": { "codepoints": [8225], "characters": "\u2021" },
    "&ddarr;": { "codepoints": [8650], "characters": "\u21CA" },
    "&ddotseq;": { "codepoints": [10871], "characters": "\u2A77" },
    "&deg": { "codepoints": [176], "characters": "\u00B0" },
    "&deg;": { "codepoints": [176], "characters": "\u00B0" },
    "&delta;": { "codepoints": [948], "characters": "\u03B4" },
    "&demptyv;": { "codepoints": [10673], "characters": "\u29B1" },
    "&dfisht;": { "codepoints": [10623], "characters": "\u297F" },
    "&dfr;": { "codepoints": [120097], "characters": "\uD835\uDD21" },
    "&dharl;": { "codepoints": [8643], "characters": "\u21C3" },
    "&dharr;": { "codepoints": [8642], "characters": "\u21C2" },
    "&diam;": { "codepoints": [8900], "characters": "\u22C4" },
    "&diamond;": { "codepoints": [8900], "characters": "\u22C4" },
    "&diamondsuit;": { "codepoints": [9830], "characters": "\u2666" },
    "&diams;": { "codepoints": [9830], "characters": "\u2666" },
    "&die;": { "codepoints": [168], "characters": "\u00A8" },
    "&digamma;": { "codepoints": [989], "characters": "\u03DD" },
    "&disin;": { "codepoints": [8946], "characters": "\u22F2" },
    "&div;": { "codepoints": [247], "characters": "\u00F7" },
    "&divide": { "codepoints": [247], "characters": "\u00F7" },
    "&divide;": { "codepoints": [247], "characters": "\u00F7" },
    "&divideontimes;": { "codepoints": [8903], "characters": "\u22C7" },
    "&divonx;": { "codepoints": [8903], "characters": "\u22C7" },
    "&djcy;": { "codepoints": [1106], "characters": "\u0452" },
    "&dlcorn;": { "codepoints": [8990], "characters": "\u231E" },
    "&dlcrop;": { "codepoints": [8973], "characters": "\u230D" },
    "&dollar;": { "codepoints": [36], "characters": "\u0024" },
    "&dopf;": { "codepoints": [120149], "characters": "\uD835\uDD55" },
    "&dot;": { "codepoints": [729], "characters": "\u02D9" },
    "&doteq;": { "codepoints": [8784], "characters": "\u2250" },
    "&doteqdot;": { "codepoints": [8785], "characters": "\u2251" },
    "&dotminus;": { "codepoints": [8760], "characters": "\u2238" },
    "&dotplus;": { "codepoints": [8724], "characters": "\u2214" },
    "&dotsquare;": { "codepoints": [8865], "characters": "\u22A1" },
    "&doublebarwedge;": { "codepoints": [8966], "characters": "\u2306" },
    "&downarrow;": { "codepoints": [8595], "characters": "\u2193" },
    "&downdownarrows;": { "codepoints": [8650], "characters": "\u21CA" },
    "&downharpoonleft;": { "codepoints": [8643], "characters": "\u21C3" },
    "&downharpoonright;": { "codepoints": [8642], "characters": "\u21C2" },
    "&drbkarow;": { "codepoints": [10512], "characters": "\u2910" },
    "&drcorn;": { "codepoints": [8991], "characters": "\u231F" },
    "&drcrop;": { "codepoints": [8972], "characters": "\u230C" },
    "&dscr;": { "codepoints": [119993], "characters": "\uD835\uDCB9" },
    "&dscy;": { "codepoints": [1109], "characters": "\u0455" },
    "&dsol;": { "codepoints": [10742], "characters": "\u29F6" },
    "&dstrok;": { "codepoints": [273], "characters": "\u0111" },
    "&dtdot;": { "codepoints": [8945], "characters": "\u22F1" },
    "&dtri;": { "codepoints": [9663], "characters": "\u25BF" },
    "&dtrif;": { "codepoints": [9662], "characters": "\u25BE" },
    "&duarr;": { "codepoints": [8693], "characters": "\u21F5" },
    "&duhar;": { "codepoints": [10607], "characters": "\u296F" },
    "&dwangle;": { "codepoints": [10662], "characters": "\u29A6" },
    "&dzcy;": { "codepoints": [1119], "characters": "\u045F" },
    "&dzigrarr;": { "codepoints": [10239], "characters": "\u27FF" },
    "&eDDot;": { "codepoints": [10871], "characters": "\u2A77" },
    "&eDot;": { "codepoints": [8785], "characters": "\u2251" },
    "&eacute": { "codepoints": [233], "characters": "\u00E9" },
    "&eacute;": { "codepoints": [233], "characters": "\u00E9" },
    "&easter;": { "codepoints": [10862], "characters": "\u2A6E" },
    "&ecaron;": { "codepoints": [283], "characters": "\u011B" },
    "&ecir;": { "codepoints": [8790], "characters": "\u2256" },
    "&ecirc": { "codepoints": [234], "characters": "\u00EA" },
    "&ecirc;": { "codepoints": [234], "characters": "\u00EA" },
    "&ecolon;": { "codepoints": [8789], "characters": "\u2255" },
    "&ecy;": { "codepoints": [1101], "characters": "\u044D" },
    "&edot;": { "codepoints": [279], "characters": "\u0117" },
    "&ee;": { "codepoints": [8519], "characters": "\u2147" },
    "&efDot;": { "codepoints": [8786], "characters": "\u2252" },
    "&efr;": { "codepoints": [120098], "characters": "\uD835\uDD22" },
    "&eg;": { "codepoints": [10906], "characters": "\u2A9A" },
    "&egrave": { "codepoints": [232], "characters": "\u00E8" },
    "&egrave;": { "codepoints": [232], "characters": "\u00E8" },
    "&egs;": { "codepoints": [10902], "characters": "\u2A96" },
    "&egsdot;": { "codepoints": [10904], "characters": "\u2A98" },
    "&el;": { "codepoints": [10905], "characters": "\u2A99" },
    "&elinters;": { "codepoints": [9191], "characters": "\u23E7" },
    "&ell;": { "codepoints": [8467], "characters": "\u2113" },
    "&els;": { "codepoints": [10901], "characters": "\u2A95" },
    "&elsdot;": { "codepoints": [10903], "characters": "\u2A97" },
    "&emacr;": { "codepoints": [275], "characters": "\u0113" },
    "&empty;": { "codepoints": [8709], "characters": "\u2205" },
    "&emptyset;": { "codepoints": [8709], "characters": "\u2205" },
    "&emptyv;": { "codepoints": [8709], "characters": "\u2205" },
    "&emsp13;": { "codepoints": [8196], "characters": "\u2004" },
    "&emsp14;": { "codepoints": [8197], "characters": "\u2005" },
    "&emsp;": { "codepoints": [8195], "characters": "\u2003" },
    "&eng;": { "codepoints": [331], "characters": "\u014B" },
    "&ensp;": { "codepoints": [8194], "characters": "\u2002" },
    "&eogon;": { "codepoints": [281], "characters": "\u0119" },
    "&eopf;": { "codepoints": [120150], "characters": "\uD835\uDD56" },
    "&epar;": { "codepoints": [8917], "characters": "\u22D5" },
    "&eparsl;": { "codepoints": [10723], "characters": "\u29E3" },
    "&eplus;": { "codepoints": [10865], "characters": "\u2A71" },
    "&epsi;": { "codepoints": [949], "characters": "\u03B5" },
    "&epsilon;": { "codepoints": [949], "characters": "\u03B5" },
    "&epsiv;": { "codepoints": [1013], "characters": "\u03F5" },
    "&eqcirc;": { "codepoints": [8790], "characters": "\u2256" },
    "&eqcolon;": { "codepoints": [8789], "characters": "\u2255" },
    "&eqsim;": { "codepoints": [8770], "characters": "\u2242" },
    "&eqslantgtr;": { "codepoints": [10902], "characters": "\u2A96" },
    "&eqslantless;": { "codepoints": [10901], "characters": "\u2A95" },
    "&equals;": { "codepoints": [61], "characters": "\u003D" },
    "&equest;": { "codepoints": [8799], "characters": "\u225F" },
    "&equiv;": { "codepoints": [8801], "characters": "\u2261" },
    "&equivDD;": { "codepoints": [10872], "characters": "\u2A78" },
    "&eqvparsl;": { "codepoints": [10725], "characters": "\u29E5" },
    "&erDot;": { "codepoints": [8787], "characters": "\u2253" },
    "&erarr;": { "codepoints": [10609], "characters": "\u2971" },
    "&escr;": { "codepoints": [8495], "characters": "\u212F" },
    "&esdot;": { "codepoints": [8784], "characters": "\u2250" },
    "&esim;": { "codepoints": [8770], "characters": "\u2242" },
    "&eta;": { "codepoints": [951], "characters": "\u03B7" },
    "&eth": { "codepoints": [240], "characters": "\u00F0" },
    "&eth;": { "codepoints": [240], "characters": "\u00F0" },
    "&euml": { "codepoints": [235], "characters": "\u00EB" },
    "&euml;": { "codepoints": [235], "characters": "\u00EB" },
    "&euro;": { "codepoints": [8364], "characters": "\u20AC" },
    "&excl;": { "codepoints": [33], "characters": "\u0021" },
    "&exist;": { "codepoints": [8707], "characters": "\u2203" },
    "&expectation;": { "codepoints": [8496], "characters": "\u2130" },
    "&exponentiale;": { "codepoints": [8519], "characters": "\u2147" },
    "&fallingdotseq;": { "codepoints": [8786], "characters": "\u2252" },
    "&fcy;": { "codepoints": [1092], "characters": "\u0444" },
    "&female;": { "codepoints": [9792], "characters": "\u2640" },
    "&ffilig;": { "codepoints": [64259], "characters": "\uFB03" },
    "&fflig;": { "codepoints": [64256], "characters": "\uFB00" },
    "&ffllig;": { "codepoints": [64260], "characters": "\uFB04" },
    "&ffr;": { "codepoints": [120099], "characters": "\uD835\uDD23" },
    "&filig;": { "codepoints": [64257], "characters": "\uFB01" },
    "&fjlig;": { "codepoints": [102, 106], "characters": "\u0066\u006A" },
    "&flat;": { "codepoints": [9837], "characters": "\u266D" },
    "&fllig;": { "codepoints": [64258], "characters": "\uFB02" },
    "&fltns;": { "codepoints": [9649], "characters": "\u25B1" },
    "&fnof;": { "codepoints": [402], "characters": "\u0192" },
    "&fopf;": { "codepoints": [120151], "characters": "\uD835\uDD57" },
    "&forall;": { "codepoints": [8704], "characters": "\u2200" },
    "&fork;": { "codepoints": [8916], "characters": "\u22D4" },
    "&forkv;": { "codepoints": [10969], "characters": "\u2AD9" },
    "&fpartint;": { "codepoints": [10765], "characters": "\u2A0D" },
    "&frac12": { "codepoints": [189], "characters": "\u00BD" },
    "&frac12;": { "codepoints": [189], "characters": "\u00BD" },
    "&frac13;": { "codepoints": [8531], "characters": "\u2153" },
    "&frac14": { "codepoints": [188], "characters": "\u00BC" },
    "&frac14;": { "codepoints": [188], "characters": "\u00BC" },
    "&frac15;": { "codepoints": [8533], "characters": "\u2155" },
    "&frac16;": { "codepoints": [8537], "characters": "\u2159" },
    "&frac18;": { "codepoints": [8539], "characters": "\u215B" },
    "&frac23;": { "codepoints": [8532], "characters": "\u2154" },
    "&frac25;": { "codepoints": [8534], "characters": "\u2156" },
    "&frac34": { "codepoints": [190], "characters": "\u00BE" },
    "&frac34;": { "codepoints": [190], "characters": "\u00BE" },
    "&frac35;": { "codepoints": [8535], "characters": "\u2157" },
    "&frac38;": { "codepoints": [8540], "characters": "\u215C" },
    "&frac45;": { "codepoints": [8536], "characters": "\u2158" },
    "&frac56;": { "codepoints": [8538], "characters": "\u215A" },
    "&frac58;": { "codepoints": [8541], "characters": "\u215D" },
    "&frac78;": { "codepoints": [8542], "characters": "\u215E" },
    "&frasl;": { "codepoints": [8260], "characters": "\u2044" },
    "&frown;": { "codepoints": [8994], "characters": "\u2322" },
    "&fscr;": { "codepoints": [119995], "characters": "\uD835\uDCBB" },
    "&gE;": { "codepoints": [8807], "characters": "\u2267" },
    "&gEl;": { "codepoints": [10892], "characters": "\u2A8C" },
    "&gacute;": { "codepoints": [501], "characters": "\u01F5" },
    "&gamma;": { "codepoints": [947], "characters": "\u03B3" },
    "&gammad;": { "codepoints": [989], "characters": "\u03DD" },
    "&gap;": { "codepoints": [10886], "characters": "\u2A86" },
    "&gbreve;": { "codepoints": [287], "characters": "\u011F" },
    "&gcirc;": { "codepoints": [285], "characters": "\u011D" },
    "&gcy;": { "codepoints": [1075], "characters": "\u0433" },
    "&gdot;": { "codepoints": [289], "characters": "\u0121" },
    "&ge;": { "codepoints": [8805], "characters": "\u2265" },
    "&gel;": { "codepoints": [8923], "characters": "\u22DB" },
    "&geq;": { "codepoints": [8805], "characters": "\u2265" },
    "&geqq;": { "codepoints": [8807], "characters": "\u2267" },
    "&geqslant;": { "codepoints": [10878], "characters": "\u2A7E" },
    "&ges;": { "codepoints": [10878], "characters": "\u2A7E" },
    "&gescc;": { "codepoints": [10921], "characters": "\u2AA9" },
    "&gesdot;": { "codepoints": [10880], "characters": "\u2A80" },
    "&gesdoto;": { "codepoints": [10882], "characters": "\u2A82" },
    "&gesdotol;": { "codepoints": [10884], "characters": "\u2A84" },
    "&gesl;": { "codepoints": [8923, 65024], "characters": "\u22DB\uFE00" },
    "&gesles;": { "codepoints": [10900], "characters": "\u2A94" },
    "&gfr;": { "codepoints": [120100], "characters": "\uD835\uDD24" },
    "&gg;": { "codepoints": [8811], "characters": "\u226B" },
    "&ggg;": { "codepoints": [8921], "characters": "\u22D9" },
    "&gimel;": { "codepoints": [8503], "characters": "\u2137" },
    "&gjcy;": { "codepoints": [1107], "characters": "\u0453" },
    "&gl;": { "codepoints": [8823], "characters": "\u2277" },
    "&glE;": { "codepoints": [10898], "characters": "\u2A92" },
    "&gla;": { "codepoints": [10917], "characters": "\u2AA5" },
    "&glj;": { "codepoints": [10916], "characters": "\u2AA4" },
    "&gnE;": { "codepoints": [8809], "characters": "\u2269" },
    "&gnap;": { "codepoints": [10890], "characters": "\u2A8A" },
    "&gnapprox;": { "codepoints": [10890], "characters": "\u2A8A" },
    "&gne;": { "codepoints": [10888], "characters": "\u2A88" },
    "&gneq;": { "codepoints": [10888], "characters": "\u2A88" },
    "&gneqq;": { "codepoints": [8809], "characters": "\u2269" },
    "&gnsim;": { "codepoints": [8935], "characters": "\u22E7" },
    "&gopf;": { "codepoints": [120152], "characters": "\uD835\uDD58" },
    "&grave;": { "codepoints": [96], "characters": "\u0060" },
    "&gscr;": { "codepoints": [8458], "characters": "\u210A" },
    "&gsim;": { "codepoints": [8819], "characters": "\u2273" },
    "&gsime;": { "codepoints": [10894], "characters": "\u2A8E" },
    "&gsiml;": { "codepoints": [10896], "characters": "\u2A90" },
    "&gt": { "codepoints": [62], "characters": "\u003E" },
    "&gt;": { "codepoints": [62], "characters": "\u003E" },
    "&gtcc;": { "codepoints": [10919], "characters": "\u2AA7" },
    "&gtcir;": { "codepoints": [10874], "characters": "\u2A7A" },
    "&gtdot;": { "codepoints": [8919], "characters": "\u22D7" },
    "&gtlPar;": { "codepoints": [10645], "characters": "\u2995" },
    "&gtquest;": { "codepoints": [10876], "characters": "\u2A7C" },
    "&gtrapprox;": { "codepoints": [10886], "characters": "\u2A86" },
    "&gtrarr;": { "codepoints": [10616], "characters": "\u2978" },
    "&gtrdot;": { "codepoints": [8919], "characters": "\u22D7" },
    "&gtreqless;": { "codepoints": [8923], "characters": "\u22DB" },
    "&gtreqqless;": { "codepoints": [10892], "characters": "\u2A8C" },
    "&gtrless;": { "codepoints": [8823], "characters": "\u2277" },
    "&gtrsim;": { "codepoints": [8819], "characters": "\u2273" },
    "&gvertneqq;": { "codepoints": [8809, 65024], "characters": "\u2269\uFE00" },
    "&gvnE;": { "codepoints": [8809, 65024], "characters": "\u2269\uFE00" },
    "&hArr;": { "codepoints": [8660], "characters": "\u21D4" },
    "&hairsp;": { "codepoints": [8202], "characters": "\u200A" },
    "&half;": { "codepoints": [189], "characters": "\u00BD" },
    "&hamilt;": { "codepoints": [8459], "characters": "\u210B" },
    "&hardcy;": { "codepoints": [1098], "characters": "\u044A" },
    "&harr;": { "codepoints": [8596], "characters": "\u2194" },
    "&harrcir;": { "codepoints": [10568], "characters": "\u2948" },
    "&harrw;": { "codepoints": [8621], "characters": "\u21AD" },
    "&hbar;": { "codepoints": [8463], "characters": "\u210F" },
    "&hcirc;": { "codepoints": [293], "characters": "\u0125" },
    "&hearts;": { "codepoints": [9829], "characters": "\u2665" },
    "&heartsuit;": { "codepoints": [9829], "characters": "\u2665" },
    "&hellip;": { "codepoints": [8230], "characters": "\u2026" },
    "&hercon;": { "codepoints": [8889], "characters": "\u22B9" },
    "&hfr;": { "codepoints": [120101], "characters": "\uD835\uDD25" },
    "&hksearow;": { "codepoints": [10533], "characters": "\u2925" },
    "&hkswarow;": { "codepoints": [10534], "characters": "\u2926" },
    "&hoarr;": { "codepoints": [8703], "characters": "\u21FF" },
    "&homtht;": { "codepoints": [8763], "characters": "\u223B" },
    "&hookleftarrow;": { "codepoints": [8617], "characters": "\u21A9" },
    "&hookrightarrow;": { "codepoints": [8618], "characters": "\u21AA" },
    "&hopf;": { "codepoints": [120153], "characters": "\uD835\uDD59" },
    "&horbar;": { "codepoints": [8213], "characters": "\u2015" },
    "&hscr;": { "codepoints": [119997], "characters": "\uD835\uDCBD" },
    "&hslash;": { "codepoints": [8463], "characters": "\u210F" },
    "&hstrok;": { "codepoints": [295], "characters": "\u0127" },
    "&hybull;": { "codepoints": [8259], "characters": "\u2043" },
    "&hyphen;": { "codepoints": [8208], "characters": "\u2010" },
    "&iacute": { "codepoints": [237], "characters": "\u00ED" },
    "&iacute;": { "codepoints": [237], "characters": "\u00ED" },
    "&ic;": { "codepoints": [8291], "characters": "\u2063" },
    "&icirc": { "codepoints": [238], "characters": "\u00EE" },
    "&icirc;": { "codepoints": [238], "characters": "\u00EE" },
    "&icy;": { "codepoints": [1080], "characters": "\u0438" },
    "&iecy;": { "codepoints": [1077], "characters": "\u0435" },
    "&iexcl": { "codepoints": [161], "characters": "\u00A1" },
    "&iexcl;": { "codepoints": [161], "characters": "\u00A1" },
    "&iff;": { "codepoints": [8660], "characters": "\u21D4" },
    "&ifr;": { "codepoints": [120102], "characters": "\uD835\uDD26" },
    "&igrave": { "codepoints": [236], "characters": "\u00EC" },
    "&igrave;": { "codepoints": [236], "characters": "\u00EC" },
    "&ii;": { "codepoints": [8520], "characters": "\u2148" },
    "&iiiint;": { "codepoints": [10764], "characters": "\u2A0C" },
    "&iiint;": { "codepoints": [8749], "characters": "\u222D" },
    "&iinfin;": { "codepoints": [10716], "characters": "\u29DC" },
    "&iiota;": { "codepoints": [8489], "characters": "\u2129" },
    "&ijlig;": { "codepoints": [307], "characters": "\u0133" },
    "&imacr;": { "codepoints": [299], "characters": "\u012B" },
    "&image;": { "codepoints": [8465], "characters": "\u2111" },
    "&imagline;": { "codepoints": [8464], "characters": "\u2110" },
    "&imagpart;": { "codepoints": [8465], "characters": "\u2111" },
    "&imath;": { "codepoints": [305], "characters": "\u0131" },
    "&imof;": { "codepoints": [8887], "characters": "\u22B7" },
    "&imped;": { "codepoints": [437], "characters": "\u01B5" },
    "&in;": { "codepoints": [8712], "characters": "\u2208" },
    "&incare;": { "codepoints": [8453], "characters": "\u2105" },
    "&infin;": { "codepoints": [8734], "characters": "\u221E" },
    "&infintie;": { "codepoints": [10717], "characters": "\u29DD" },
    "&inodot;": { "codepoints": [305], "characters": "\u0131" },
    "&int;": { "codepoints": [8747], "characters": "\u222B" },
    "&intcal;": { "codepoints": [8890], "characters": "\u22BA" },
    "&integers;": { "codepoints": [8484], "characters": "\u2124" },
    "&intercal;": { "codepoints": [8890], "characters": "\u22BA" },
    "&intlarhk;": { "codepoints": [10775], "characters": "\u2A17" },
    "&intprod;": { "codepoints": [10812], "characters": "\u2A3C" },
    "&iocy;": { "codepoints": [1105], "characters": "\u0451" },
    "&iogon;": { "codepoints": [303], "characters": "\u012F" },
    "&iopf;": { "codepoints": [120154], "characters": "\uD835\uDD5A" },
    "&iota;": { "codepoints": [953], "characters": "\u03B9" },
    "&iprod;": { "codepoints": [10812], "characters": "\u2A3C" },
    "&iquest": { "codepoints": [191], "characters": "\u00BF" },
    "&iquest;": { "codepoints": [191], "characters": "\u00BF" },
    "&iscr;": { "codepoints": [119998], "characters": "\uD835\uDCBE" },
    "&isin;": { "codepoints": [8712], "characters": "\u2208" },
    "&isinE;": { "codepoints": [8953], "characters": "\u22F9" },
    "&isindot;": { "codepoints": [8949], "characters": "\u22F5" },
    "&isins;": { "codepoints": [8948], "characters": "\u22F4" },
    "&isinsv;": { "codepoints": [8947], "characters": "\u22F3" },
    "&isinv;": { "codepoints": [8712], "characters": "\u2208" },
    "&it;": { "codepoints": [8290], "characters": "\u2062" },
    "&itilde;": { "codepoints": [297], "characters": "\u0129" },
    "&iukcy;": { "codepoints": [1110], "characters": "\u0456" },
    "&iuml": { "codepoints": [239], "characters": "\u00EF" },
    "&iuml;": { "codepoints": [239], "characters": "\u00EF" },
    "&jcirc;": { "codepoints": [309], "characters": "\u0135" },
    "&jcy;": { "codepoints": [1081], "characters": "\u0439" },
    "&jfr;": { "codepoints": [120103], "characters": "\uD835\uDD27" },
    "&jmath;": { "codepoints": [567], "characters": "\u0237" },
    "&jopf;": { "codepoints": [120155], "characters": "\uD835\uDD5B" },
    "&jscr;": { "codepoints": [119999], "characters": "\uD835\uDCBF" },
    "&jsercy;": { "codepoints": [1112], "characters": "\u0458" },
    "&jukcy;": { "codepoints": [1108], "characters": "\u0454" },
    "&kappa;": { "codepoints": [954], "characters": "\u03BA" },
    "&kappav;": { "codepoints": [1008], "characters": "\u03F0" },
    "&kcedil;": { "codepoints": [311], "characters": "\u0137" },
    "&kcy;": { "codepoints": [1082], "characters": "\u043A" },
    "&kfr;": { "codepoints": [120104], "characters": "\uD835\uDD28" },
    "&kgreen;": { "codepoints": [312], "characters": "\u0138" },
    "&khcy;": { "codepoints": [1093], "characters": "\u0445" },
    "&kjcy;": { "codepoints": [1116], "characters": "\u045C" },
    "&kopf;": { "codepoints": [120156], "characters": "\uD835\uDD5C" },
    "&kscr;": { "codepoints": [120000], "characters": "\uD835\uDCC0" },
    "&lAarr;": { "codepoints": [8666], "characters": "\u21DA" },
    "&lArr;": { "codepoints": [8656], "characters": "\u21D0" },
    "&lAtail;": { "codepoints": [10523], "characters": "\u291B" },
    "&lBarr;": { "codepoints": [10510], "characters": "\u290E" },
    "&lE;": { "codepoints": [8806], "characters": "\u2266" },
    "&lEg;": { "codepoints": [10891], "characters": "\u2A8B" },
    "&lHar;": { "codepoints": [10594], "characters": "\u2962" },
    "&lacute;": { "codepoints": [314], "characters": "\u013A" },
    "&laemptyv;": { "codepoints": [10676], "characters": "\u29B4" },
    "&lagran;": { "codepoints": [8466], "characters": "\u2112" },
    "&lambda;": { "codepoints": [955], "characters": "\u03BB" },
    "&lang;": { "codepoints": [10216], "characters": "\u27E8" },
    "&langd;": { "codepoints": [10641], "characters": "\u2991" },
    "&langle;": { "codepoints": [10216], "characters": "\u27E8" },
    "&lap;": { "codepoints": [10885], "characters": "\u2A85" },
    "&laquo": { "codepoints": [171], "characters": "\u00AB" },
    "&laquo;": { "codepoints": [171], "characters": "\u00AB" },
    "&larr;": { "codepoints": [8592], "characters": "\u2190" },
    "&larrb;": { "codepoints": [8676], "characters": "\u21E4" },
    "&larrbfs;": { "codepoints": [10527], "characters": "\u291F" },
    "&larrfs;": { "codepoints": [10525], "characters": "\u291D" },
    "&larrhk;": { "codepoints": [8617], "characters": "\u21A9" },
    "&larrlp;": { "codepoints": [8619], "characters": "\u21AB" },
    "&larrpl;": { "codepoints": [10553], "characters": "\u2939" },
    "&larrsim;": { "codepoints": [10611], "characters": "\u2973" },
    "&larrtl;": { "codepoints": [8610], "characters": "\u21A2" },
    "&lat;": { "codepoints": [10923], "characters": "\u2AAB" },
    "&latail;": { "codepoints": [10521], "characters": "\u2919" },
    "&late;": { "codepoints": [10925], "characters": "\u2AAD" },
    "&lates;": { "codepoints": [10925, 65024], "characters": "\u2AAD\uFE00" },
    "&lbarr;": { "codepoints": [10508], "characters": "\u290C" },
    "&lbbrk;": { "codepoints": [10098], "characters": "\u2772" },
    "&lbrace;": { "codepoints": [123], "characters": "\u007B" },
    "&lbrack;": { "codepoints": [91], "characters": "\u005B" },
    "&lbrke;": { "codepoints": [10635], "characters": "\u298B" },
    "&lbrksld;": { "codepoints": [10639], "characters": "\u298F" },
    "&lbrkslu;": { "codepoints": [10637], "characters": "\u298D" },
    "&lcaron;": { "codepoints": [318], "characters": "\u013E" },
    "&lcedil;": { "codepoints": [316], "characters": "\u013C" },
    "&lceil;": { "codepoints": [8968], "characters": "\u2308" },
    "&lcub;": { "codepoints": [123], "characters": "\u007B" },
    "&lcy;": { "codepoints": [1083], "characters": "\u043B" },
    "&ldca;": { "codepoints": [10550], "characters": "\u2936" },
    "&ldquo;": { "codepoints": [8220], "characters": "\u201C" },
    "&ldquor;": { "codepoints": [8222], "characters": "\u201E" },
    "&ldrdhar;": { "codepoints": [10599], "characters": "\u2967" },
    "&ldrushar;": { "codepoints": [10571], "characters": "\u294B" },
    "&ldsh;": { "codepoints": [8626], "characters": "\u21B2" },
    "&le;": { "codepoints": [8804], "characters": "\u2264" },
    "&leftarrow;": { "codepoints": [8592], "characters": "\u2190" },
    "&leftarrowtail;": { "codepoints": [8610], "characters": "\u21A2" },
    "&leftharpoondown;": { "codepoints": [8637], "characters": "\u21BD" },
    "&leftharpoonup;": { "codepoints": [8636], "characters": "\u21BC" },
    "&leftleftarrows;": { "codepoints": [8647], "characters": "\u21C7" },
    "&leftrightarrow;": { "codepoints": [8596], "characters": "\u2194" },
    "&leftrightarrows;": { "codepoints": [8646], "characters": "\u21C6" },
    "&leftrightharpoons;": { "codepoints": [8651], "characters": "\u21CB" },
    "&leftrightsquigarrow;": { "codepoints": [8621], "characters": "\u21AD" },
    "&leftthreetimes;": { "codepoints": [8907], "characters": "\u22CB" },
    "&leg;": { "codepoints": [8922], "characters": "\u22DA" },
    "&leq;": { "codepoints": [8804], "characters": "\u2264" },
    "&leqq;": { "codepoints": [8806], "characters": "\u2266" },
    "&leqslant;": { "codepoints": [10877], "characters": "\u2A7D" },
    "&les;": { "codepoints": [10877], "characters": "\u2A7D" },
    "&lescc;": { "codepoints": [10920], "characters": "\u2AA8" },
    "&lesdot;": { "codepoints": [10879], "characters": "\u2A7F" },
    "&lesdoto;": { "codepoints": [10881], "characters": "\u2A81" },
    "&lesdotor;": { "codepoints": [10883], "characters": "\u2A83" },
    "&lesg;": { "codepoints": [8922, 65024], "characters": "\u22DA\uFE00" },
    "&lesges;": { "codepoints": [10899], "characters": "\u2A93" },
    "&lessapprox;": { "codepoints": [10885], "characters": "\u2A85" },
    "&lessdot;": { "codepoints": [8918], "characters": "\u22D6" },
    "&lesseqgtr;": { "codepoints": [8922], "characters": "\u22DA" },
    "&lesseqqgtr;": { "codepoints": [10891], "characters": "\u2A8B" },
    "&lessgtr;": { "codepoints": [8822], "characters": "\u2276" },
    "&lesssim;": { "codepoints": [8818], "characters": "\u2272" },
    "&lfisht;": { "codepoints": [10620], "characters": "\u297C" },
    "&lfloor;": { "codepoints": [8970], "characters": "\u230A" },
    "&lfr;": { "codepoints": [120105], "characters": "\uD835\uDD29" },
    "&lg;": { "codepoints": [8822], "characters": "\u2276" },
    "&lgE;": { "codepoints": [10897], "characters": "\u2A91" },
    "&lhard;": { "codepoints": [8637], "characters": "\u21BD" },
    "&lharu;": { "codepoints": [8636], "characters": "\u21BC" },
    "&lharul;": { "codepoints": [10602], "characters": "\u296A" },
    "&lhblk;": { "codepoints": [9604], "characters": "\u2584" },
    "&ljcy;": { "codepoints": [1113], "characters": "\u0459" },
    "&ll;": { "codepoints": [8810], "characters": "\u226A" },
    "&llarr;": { "codepoints": [8647], "characters": "\u21C7" },
    "&llcorner;": { "codepoints": [8990], "characters": "\u231E" },
    "&llhard;": { "codepoints": [10603], "characters": "\u296B" },
    "&lltri;": { "codepoints": [9722], "characters": "\u25FA" },
    "&lmidot;": { "codepoints": [320], "characters": "\u0140" },
    "&lmoust;": { "codepoints": [9136], "characters": "\u23B0" },
    "&lmoustache;": { "codepoints": [9136], "characters": "\u23B0" },
    "&lnE;": { "codepoints": [8808], "characters": "\u2268" },
    "&lnap;": { "codepoints": [10889], "characters": "\u2A89" },
    "&lnapprox;": { "codepoints": [10889], "characters": "\u2A89" },
    "&lne;": { "codepoints": [10887], "characters": "\u2A87" },
    "&lneq;": { "codepoints": [10887], "characters": "\u2A87" },
    "&lneqq;": { "codepoints": [8808], "characters": "\u2268" },
    "&lnsim;": { "codepoints": [8934], "characters": "\u22E6" },
    "&loang;": { "codepoints": [10220], "characters": "\u27EC" },
    "&loarr;": { "codepoints": [8701], "characters": "\u21FD" },
    "&lobrk;": { "codepoints": [10214], "characters": "\u27E6" },
    "&longleftarrow;": { "codepoints": [10229], "characters": "\u27F5" },
    "&longleftrightarrow;": { "codepoints": [10231], "characters": "\u27F7" },
    "&longmapsto;": { "codepoints": [10236], "characters": "\u27FC" },
    "&longrightarrow;": { "codepoints": [10230], "characters": "\u27F6" },
    "&looparrowleft;": { "codepoints": [8619], "characters": "\u21AB" },
    "&looparrowright;": { "codepoints": [8620], "characters": "\u21AC" },
    "&lopar;": { "codepoints": [10629], "characters": "\u2985" },
    "&lopf;": { "codepoints": [120157], "characters": "\uD835\uDD5D" },
    "&loplus;": { "codepoints": [10797], "characters": "\u2A2D" },
    "&lotimes;": { "codepoints": [10804], "characters": "\u2A34" },
    "&lowast;": { "codepoints": [8727], "characters": "\u2217" },
    "&lowbar;": { "codepoints": [95], "characters": "\u005F" },
    "&loz;": { "codepoints": [9674], "characters": "\u25CA" },
    "&lozenge;": { "codepoints": [9674], "characters": "\u25CA" },
    "&lozf;": { "codepoints": [10731], "characters": "\u29EB" },
    "&lpar;": { "codepoints": [40], "characters": "\u0028" },
    "&lparlt;": { "codepoints": [10643], "characters": "\u2993" },
    "&lrarr;": { "codepoints": [8646], "characters": "\u21C6" },
    "&lrcorner;": { "codepoints": [8991], "characters": "\u231F" },
    "&lrhar;": { "codepoints": [8651], "characters": "\u21CB" },
    "&lrhard;": { "codepoints": [10605], "characters": "\u296D" },
    "&lrm;": { "codepoints": [8206], "characters": "\u200E" },
    "&lrtri;": { "codepoints": [8895], "characters": "\u22BF" },
    "&lsaquo;": { "codepoints": [8249], "characters": "\u2039" },
    "&lscr;": { "codepoints": [120001], "characters": "\uD835\uDCC1" },
    "&lsh;": { "codepoints": [8624], "characters": "\u21B0" },
    "&lsim;": { "codepoints": [8818], "characters": "\u2272" },
    "&lsime;": { "codepoints": [10893], "characters": "\u2A8D" },
    "&lsimg;": { "codepoints": [10895], "characters": "\u2A8F" },
    "&lsqb;": { "codepoints": [91], "characters": "\u005B" },
    "&lsquo;": { "codepoints": [8216], "characters": "\u2018" },
    "&lsquor;": { "codepoints": [8218], "characters": "\u201A" },
    "&lstrok;": { "codepoints": [322], "characters": "\u0142" },
    "&lt": { "codepoints": [60], "characters": "\u003C" },
    "&lt;": { "codepoints": [60], "characters": "\u003C" },
    "&ltcc;": { "codepoints": [10918], "characters": "\u2AA6" },
    "&ltcir;": { "codepoints": [10873], "characters": "\u2A79" },
    "&ltdot;": { "codepoints": [8918], "characters": "\u22D6" },
    "&lthree;": { "codepoints": [8907], "characters": "\u22CB" },
    "&ltimes;": { "codepoints": [8905], "characters": "\u22C9" },
    "&ltlarr;": { "codepoints": [10614], "characters": "\u2976" },
    "&ltquest;": { "codepoints": [10875], "characters": "\u2A7B" },
    "&ltrPar;": { "codepoints": [10646], "characters": "\u2996" },
    "&ltri;": { "codepoints": [9667], "characters": "\u25C3" },
    "&ltrie;": { "codepoints": [8884], "characters": "\u22B4" },
    "&ltrif;": { "codepoints": [9666], "characters": "\u25C2" },
    "&lurdshar;": { "codepoints": [10570], "characters": "\u294A" },
    "&luruhar;": { "codepoints": [10598], "characters": "\u2966" },
    "&lvertneqq;": { "codepoints": [8808, 65024], "characters": "\u2268\uFE00" },
    "&lvnE;": { "codepoints": [8808, 65024], "characters": "\u2268\uFE00" },
    "&mDDot;": { "codepoints": [8762], "characters": "\u223A" },
    "&macr": { "codepoints": [175], "characters": "\u00AF" },
    "&macr;": { "codepoints": [175], "characters": "\u00AF" },
    "&male;": { "codepoints": [9794], "characters": "\u2642" },
    "&malt;": { "codepoints": [10016], "characters": "\u2720" },
    "&maltese;": { "codepoints": [10016], "characters": "\u2720" },
    "&map;": { "codepoints": [8614], "characters": "\u21A6" },
    "&mapsto;": { "codepoints": [8614], "characters": "\u21A6" },
    "&mapstodown;": { "codepoints": [8615], "characters": "\u21A7" },
    "&mapstoleft;": { "codepoints": [8612], "characters": "\u21A4" },
    "&mapstoup;": { "codepoints": [8613], "characters": "\u21A5" },
    "&marker;": { "codepoints": [9646], "characters": "\u25AE" },
    "&mcomma;": { "codepoints": [10793], "characters": "\u2A29" },
    "&mcy;": { "codepoints": [1084], "characters": "\u043C" },
    "&mdash;": { "codepoints": [8212], "characters": "\u2014" },
    "&measuredangle;": { "codepoints": [8737], "characters": "\u2221" },
    "&mfr;": { "codepoints": [120106], "characters": "\uD835\uDD2A" },
    "&mho;": { "codepoints": [8487], "characters": "\u2127" },
    "&micro": { "codepoints": [181], "characters": "\u00B5" },
    "&micro;": { "codepoints": [181], "characters": "\u00B5" },
    "&mid;": { "codepoints": [8739], "characters": "\u2223" },
    "&midast;": { "codepoints": [42], "characters": "\u002A" },
    "&midcir;": { "codepoints": [10992], "characters": "\u2AF0" },
    "&middot": { "codepoints": [183], "characters": "\u00B7" },
    "&middot;": { "codepoints": [183], "characters": "\u00B7" },
    "&minus;": { "codepoints": [8722], "characters": "\u2212" },
    "&minusb;": { "codepoints": [8863], "characters": "\u229F" },
    "&minusd;": { "codepoints": [8760], "characters": "\u2238" },
    "&minusdu;": { "codepoints": [10794], "characters": "\u2A2A" },
    "&mlcp;": { "codepoints": [10971], "characters": "\u2ADB" },
    "&mldr;": { "codepoints": [8230], "characters": "\u2026" },
    "&mnplus;": { "codepoints": [8723], "characters": "\u2213" },
    "&models;": { "codepoints": [8871], "characters": "\u22A7" },
    "&mopf;": { "codepoints": [120158], "characters": "\uD835\uDD5E" },
    "&mp;": { "codepoints": [8723], "characters": "\u2213" },
    "&mscr;": { "codepoints": [120002], "characters": "\uD835\uDCC2" },
    "&mstpos;": { "codepoints": [8766], "characters": "\u223E" },
    "&mu;": { "codepoints": [956], "characters": "\u03BC" },
    "&multimap;": { "codepoints": [8888], "characters": "\u22B8" },
    "&mumap;": { "codepoints": [8888], "characters": "\u22B8" },
    "&nGg;": { "codepoints": [8921, 824], "characters": "\u22D9\u0338" },
    "&nGt;": { "codepoints": [8811, 8402], "characters": "\u226B\u20D2" },
    "&nGtv;": { "codepoints": [8811, 824], "characters": "\u226B\u0338" },
    "&nLeftarrow;": { "codepoints": [8653], "characters": "\u21CD" },
    "&nLeftrightarrow;": { "codepoints": [8654], "characters": "\u21CE" },
    "&nLl;": { "codepoints": [8920, 824], "characters": "\u22D8\u0338" },
    "&nLt;": { "codepoints": [8810, 8402], "characters": "\u226A\u20D2" },
    "&nLtv;": { "codepoints": [8810, 824], "characters": "\u226A\u0338" },
    "&nRightarrow;": { "codepoints": [8655], "characters": "\u21CF" },
    "&nVDash;": { "codepoints": [8879], "characters": "\u22AF" },
    "&nVdash;": { "codepoints": [8878], "characters": "\u22AE" },
    "&nabla;": { "codepoints": [8711], "characters": "\u2207" },
    "&nacute;": { "codepoints": [324], "characters": "\u0144" },
    "&nang;": { "codepoints": [8736, 8402], "characters": "\u2220\u20D2" },
    "&nap;": { "codepoints": [8777], "characters": "\u2249" },
    "&napE;": { "codepoints": [10864, 824], "characters": "\u2A70\u0338" },
    "&napid;": { "codepoints": [8779, 824], "characters": "\u224B\u0338" },
    "&napos;": { "codepoints": [329], "characters": "\u0149" },
    "&napprox;": { "codepoints": [8777], "characters": "\u2249" },
    "&natur;": { "codepoints": [9838], "characters": "\u266E" },
    "&natural;": { "codepoints": [9838], "characters": "\u266E" },
    "&naturals;": { "codepoints": [8469], "characters": "\u2115" },
    "&nbsp": { "codepoints": [160], "characters": "\u00A0" },
    "&nbsp;": { "codepoints": [160], "characters": "\u00A0" },
    "&nbump;": { "codepoints": [8782, 824], "characters": "\u224E\u0338" },
    "&nbumpe;": { "codepoints": [8783, 824], "characters": "\u224F\u0338" },
    "&ncap;": { "codepoints": [10819], "characters": "\u2A43" },
    "&ncaron;": { "codepoints": [328], "characters": "\u0148" },
    "&ncedil;": { "codepoints": [326], "characters": "\u0146" },
    "&ncong;": { "codepoints": [8775], "characters": "\u2247" },
    "&ncongdot;": { "codepoints": [10861, 824], "characters": "\u2A6D\u0338" },
    "&ncup;": { "codepoints": [10818], "characters": "\u2A42" },
    "&ncy;": { "codepoints": [1085], "characters": "\u043D" },
    "&ndash;": { "codepoints": [8211], "characters": "\u2013" },
    "&ne;": { "codepoints": [8800], "characters": "\u2260" },
    "&neArr;": { "codepoints": [8663], "characters": "\u21D7" },
    "&nearhk;": { "codepoints": [10532], "characters": "\u2924" },
    "&nearr;": { "codepoints": [8599], "characters": "\u2197" },
    "&nearrow;": { "codepoints": [8599], "characters": "\u2197" },
    "&nedot;": { "codepoints": [8784, 824], "characters": "\u2250\u0338" },
    "&nequiv;": { "codepoints": [8802], "characters": "\u2262" },
    "&nesear;": { "codepoints": [10536], "characters": "\u2928" },
    "&nesim;": { "codepoints": [8770, 824], "characters": "\u2242\u0338" },
    "&nexist;": { "codepoints": [8708], "characters": "\u2204" },
    "&nexists;": { "codepoints": [8708], "characters": "\u2204" },
    "&nfr;": { "codepoints": [120107], "characters": "\uD835\uDD2B" },
    "&ngE;": { "codepoints": [8807, 824], "characters": "\u2267\u0338" },
    "&nge;": { "codepoints": [8817], "characters": "\u2271" },
    "&ngeq;": { "codepoints": [8817], "characters": "\u2271" },
    "&ngeqq;": { "codepoints": [8807, 824], "characters": "\u2267\u0338" },
    "&ngeqslant;": { "codepoints": [10878, 824], "characters": "\u2A7E\u0338" },
    "&nges;": { "codepoints": [10878, 824], "characters": "\u2A7E\u0338" },
    "&ngsim;": { "codepoints": [8821], "characters": "\u2275" },
    "&ngt;": { "codepoints": [8815], "characters": "\u226F" },
    "&ngtr;": { "codepoints": [8815], "characters": "\u226F" },
    "&nhArr;": { "codepoints": [8654], "characters": "\u21CE" },
    "&nharr;": { "codepoints": [8622], "characters": "\u21AE" },
    "&nhpar;": { "codepoints": [10994], "characters": "\u2AF2" },
    "&ni;": { "codepoints": [8715], "characters": "\u220B" },
    "&nis;": { "codepoints": [8956], "characters": "\u22FC" },
    "&nisd;": { "codepoints": [8954], "characters": "\u22FA" },
    "&niv;": { "codepoints": [8715], "characters": "\u220B" },
    "&njcy;": { "codepoints": [1114], "characters": "\u045A" },
    "&nlArr;": { "codepoints": [8653], "characters": "\u21CD" },
    "&nlE;": { "codepoints": [8806, 824], "characters": "\u2266\u0338" },
    "&nlarr;": { "codepoints": [8602], "characters": "\u219A" },
    "&nldr;": { "codepoints": [8229], "characters": "\u2025" },
    "&nle;": { "codepoints": [8816], "characters": "\u2270" },
    "&nleftarrow;": { "codepoints": [8602], "characters": "\u219A" },
    "&nleftrightarrow;": { "codepoints": [8622], "characters": "\u21AE" },
    "&nleq;": { "codepoints": [8816], "characters": "\u2270" },
    "&nleqq;": { "codepoints": [8806, 824], "characters": "\u2266\u0338" },
    "&nleqslant;": { "codepoints": [10877, 824], "characters": "\u2A7D\u0338" },
    "&nles;": { "codepoints": [10877, 824], "characters": "\u2A7D\u0338" },
    "&nless;": { "codepoints": [8814], "characters": "\u226E" },
    "&nlsim;": { "codepoints": [8820], "characters": "\u2274" },
    "&nlt;": { "codepoints": [8814], "characters": "\u226E" },
    "&nltri;": { "codepoints": [8938], "characters": "\u22EA" },
    "&nltrie;": { "codepoints": [8940], "characters": "\u22EC" },
    "&nmid;": { "codepoints": [8740], "characters": "\u2224" },
    "&nopf;": { "codepoints": [120159], "characters": "\uD835\uDD5F" },
    "&not": { "codepoints": [172], "characters": "\u00AC" },
    "&not;": { "codepoints": [172], "characters": "\u00AC" },
    "&notin;": { "codepoints": [8713], "characters": "\u2209" },
    "&notinE;": { "codepoints": [8953, 824], "characters": "\u22F9\u0338" },
    "&notindot;": { "codepoints": [8949, 824], "characters": "\u22F5\u0338" },
    "&notinva;": { "codepoints": [8713], "characters": "\u2209" },
    "&notinvb;": { "codepoints": [8951], "characters": "\u22F7" },
    "&notinvc;": { "codepoints": [8950], "characters": "\u22F6" },
    "&notni;": { "codepoints": [8716], "characters": "\u220C" },
    "&notniva;": { "codepoints": [8716], "characters": "\u220C" },
    "&notnivb;": { "codepoints": [8958], "characters": "\u22FE" },
    "&notnivc;": { "codepoints": [8957], "characters": "\u22FD" },
    "&npar;": { "codepoints": [8742], "characters": "\u2226" },
    "&nparallel;": { "codepoints": [8742], "characters": "\u2226" },
    "&nparsl;": { "codepoints": [11005, 8421], "characters": "\u2AFD\u20E5" },
    "&npart;": { "codepoints": [8706, 824], "characters": "\u2202\u0338" },
    "&npolint;": { "codepoints": [10772], "characters": "\u2A14" },
    "&npr;": { "codepoints": [8832], "characters": "\u2280" },
    "&nprcue;": { "codepoints": [8928], "characters": "\u22E0" },
    "&npre;": { "codepoints": [10927, 824], "characters": "\u2AAF\u0338" },
    "&nprec;": { "codepoints": [8832], "characters": "\u2280" },
    "&npreceq;": { "codepoints": [10927, 824], "characters": "\u2AAF\u0338" },
    "&nrArr;": { "codepoints": [8655], "characters": "\u21CF" },
    "&nrarr;": { "codepoints": [8603], "characters": "\u219B" },
    "&nrarrc;": { "codepoints": [10547, 824], "characters": "\u2933\u0338" },
    "&nrarrw;": { "codepoints": [8605, 824], "characters": "\u219D\u0338" },
    "&nrightarrow;": { "codepoints": [8603], "characters": "\u219B" },
    "&nrtri;": { "codepoints": [8939], "characters": "\u22EB" },
    "&nrtrie;": { "codepoints": [8941], "characters": "\u22ED" },
    "&nsc;": { "codepoints": [8833], "characters": "\u2281" },
    "&nsccue;": { "codepoints": [8929], "characters": "\u22E1" },
    "&nsce;": { "codepoints": [10928, 824], "characters": "\u2AB0\u0338" },
    "&nscr;": { "codepoints": [120003], "characters": "\uD835\uDCC3" },
    "&nshortmid;": { "codepoints": [8740], "characters": "\u2224" },
    "&nshortparallel;": { "codepoints": [8742], "characters": "\u2226" },
    "&nsim;": { "codepoints": [8769], "characters": "\u2241" },
    "&nsime;": { "codepoints": [8772], "characters": "\u2244" },
    "&nsimeq;": { "codepoints": [8772], "characters": "\u2244" },
    "&nsmid;": { "codepoints": [8740], "characters": "\u2224" },
    "&nspar;": { "codepoints": [8742], "characters": "\u2226" },
    "&nsqsube;": { "codepoints": [8930], "characters": "\u22E2" },
    "&nsqsupe;": { "codepoints": [8931], "characters": "\u22E3" },
    "&nsub;": { "codepoints": [8836], "characters": "\u2284" },
    "&nsubE;": { "codepoints": [10949, 824], "characters": "\u2AC5\u0338" },
    "&nsube;": { "codepoints": [8840], "characters": "\u2288" },
    "&nsubset;": { "codepoints": [8834, 8402], "characters": "\u2282\u20D2" },
    "&nsubseteq;": { "codepoints": [8840], "characters": "\u2288" },
    "&nsubseteqq;": { "codepoints": [10949, 824], "characters": "\u2AC5\u0338" },
    "&nsucc;": { "codepoints": [8833], "characters": "\u2281" },
    "&nsucceq;": { "codepoints": [10928, 824], "characters": "\u2AB0\u0338" },
    "&nsup;": { "codepoints": [8837], "characters": "\u2285" },
    "&nsupE;": { "codepoints": [10950, 824], "characters": "\u2AC6\u0338" },
    "&nsupe;": { "codepoints": [8841], "characters": "\u2289" },
    "&nsupset;": { "codepoints": [8835, 8402], "characters": "\u2283\u20D2" },
    "&nsupseteq;": { "codepoints": [8841], "characters": "\u2289" },
    "&nsupseteqq;": { "codepoints": [10950, 824], "characters": "\u2AC6\u0338" },
    "&ntgl;": { "codepoints": [8825], "characters": "\u2279" },
    "&ntilde": { "codepoints": [241], "characters": "\u00F1" },
    "&ntilde;": { "codepoints": [241], "characters": "\u00F1" },
    "&ntlg;": { "codepoints": [8824], "characters": "\u2278" },
    "&ntriangleleft;": { "codepoints": [8938], "characters": "\u22EA" },
    "&ntrianglelefteq;": { "codepoints": [8940], "characters": "\u22EC" },
    "&ntriangleright;": { "codepoints": [8939], "characters": "\u22EB" },
    "&ntrianglerighteq;": { "codepoints": [8941], "characters": "\u22ED" },
    "&nu;": { "codepoints": [957], "characters": "\u03BD" },
    "&num;": { "codepoints": [35], "characters": "\u0023" },
    "&numero;": { "codepoints": [8470], "characters": "\u2116" },
    "&numsp;": { "codepoints": [8199], "characters": "\u2007" },
    "&nvDash;": { "codepoints": [8877], "characters": "\u22AD" },
    "&nvHarr;": { "codepoints": [10500], "characters": "\u2904" },
    "&nvap;": { "codepoints": [8781, 8402], "characters": "\u224D\u20D2" },
    "&nvdash;": { "codepoints": [8876], "characters": "\u22AC" },
    "&nvge;": { "codepoints": [8805, 8402], "characters": "\u2265\u20D2" },
    "&nvgt;": { "codepoints": [62, 8402], "characters": "\u003E\u20D2" },
    "&nvinfin;": { "codepoints": [10718], "characters": "\u29DE" },
    "&nvlArr;": { "codepoints": [10498], "characters": "\u2902" },
    "&nvle;": { "codepoints": [8804, 8402], "characters": "\u2264\u20D2" },
    "&nvlt;": { "codepoints": [60, 8402], "characters": "\u003C\u20D2" },
    "&nvltrie;": { "codepoints": [8884, 8402], "characters": "\u22B4\u20D2" },
    "&nvrArr;": { "codepoints": [10499], "characters": "\u2903" },
    "&nvrtrie;": { "codepoints": [8885, 8402], "characters": "\u22B5\u20D2" },
    "&nvsim;": { "codepoints": [8764, 8402], "characters": "\u223C\u20D2" },
    "&nwArr;": { "codepoints": [8662], "characters": "\u21D6" },
    "&nwarhk;": { "codepoints": [10531], "characters": "\u2923" },
    "&nwarr;": { "codepoints": [8598], "characters": "\u2196" },
    "&nwarrow;": { "codepoints": [8598], "characters": "\u2196" },
    "&nwnear;": { "codepoints": [10535], "characters": "\u2927" },
    "&oS;": { "codepoints": [9416], "characters": "\u24C8" },
    "&oacute": { "codepoints": [243], "characters": "\u00F3" },
    "&oacute;": { "codepoints": [243], "characters": "\u00F3" },
    "&oast;": { "codepoints": [8859], "characters": "\u229B" },
    "&ocir;": { "codepoints": [8858], "characters": "\u229A" },
    "&ocirc": { "codepoints": [244], "characters": "\u00F4" },
    "&ocirc;": { "codepoints": [244], "characters": "\u00F4" },
    "&ocy;": { "codepoints": [1086], "characters": "\u043E" },
    "&odash;": { "codepoints": [8861], "characters": "\u229D" },
    "&odblac;": { "codepoints": [337], "characters": "\u0151" },
    "&odiv;": { "codepoints": [10808], "characters": "\u2A38" },
    "&odot;": { "codepoints": [8857], "characters": "\u2299" },
    "&odsold;": { "codepoints": [10684], "characters": "\u29BC" },
    "&oelig;": { "codepoints": [339], "characters": "\u0153" },
    "&ofcir;": { "codepoints": [10687], "characters": "\u29BF" },
    "&ofr;": { "codepoints": [120108], "characters": "\uD835\uDD2C" },
    "&ogon;": { "codepoints": [731], "characters": "\u02DB" },
    "&ograve": { "codepoints": [242], "characters": "\u00F2" },
    "&ograve;": { "codepoints": [242], "characters": "\u00F2" },
    "&ogt;": { "codepoints": [10689], "characters": "\u29C1" },
    "&ohbar;": { "codepoints": [10677], "characters": "\u29B5" },
    "&ohm;": { "codepoints": [937], "characters": "\u03A9" },
    "&oint;": { "codepoints": [8750], "characters": "\u222E" },
    "&olarr;": { "codepoints": [8634], "characters": "\u21BA" },
    "&olcir;": { "codepoints": [10686], "characters": "\u29BE" },
    "&olcross;": { "codepoints": [10683], "characters": "\u29BB" },
    "&oline;": { "codepoints": [8254], "characters": "\u203E" },
    "&olt;": { "codepoints": [10688], "characters": "\u29C0" },
    "&omacr;": { "codepoints": [333], "characters": "\u014D" },
    "&omega;": { "codepoints": [969], "characters": "\u03C9" },
    "&omicron;": { "codepoints": [959], "characters": "\u03BF" },
    "&omid;": { "codepoints": [10678], "characters": "\u29B6" },
    "&ominus;": { "codepoints": [8854], "characters": "\u2296" },
    "&oopf;": { "codepoints": [120160], "characters": "\uD835\uDD60" },
    "&opar;": { "codepoints": [10679], "characters": "\u29B7" },
    "&operp;": { "codepoints": [10681], "characters": "\u29B9" },
    "&oplus;": { "codepoints": [8853], "characters": "\u2295" },
    "&or;": { "codepoints": [8744], "characters": "\u2228" },
    "&orarr;": { "codepoints": [8635], "characters": "\u21BB" },
    "&ord;": { "codepoints": [10845], "characters": "\u2A5D" },
    "&order;": { "codepoints": [8500], "characters": "\u2134" },
    "&orderof;": { "codepoints": [8500], "characters": "\u2134" },
    "&ordf": { "codepoints": [170], "characters": "\u00AA" },
    "&ordf;": { "codepoints": [170], "characters": "\u00AA" },
    "&ordm": { "codepoints": [186], "characters": "\u00BA" },
    "&ordm;": { "codepoints": [186], "characters": "\u00BA" },
    "&origof;": { "codepoints": [8886], "characters": "\u22B6" },
    "&oror;": { "codepoints": [10838], "characters": "\u2A56" },
    "&orslope;": { "codepoints": [10839], "characters": "\u2A57" },
    "&orv;": { "codepoints": [10843], "characters": "\u2A5B" },
    "&oscr;": { "codepoints": [8500], "characters": "\u2134" },
    "&oslash": { "codepoints": [248], "characters": "\u00F8" },
    "&oslash;": { "codepoints": [248], "characters": "\u00F8" },
    "&osol;": { "codepoints": [8856], "characters": "\u2298" },
    "&otilde": { "codepoints": [245], "characters": "\u00F5" },
    "&otilde;": { "codepoints": [245], "characters": "\u00F5" },
    "&otimes;": { "codepoints": [8855], "characters": "\u2297" },
    "&otimesas;": { "codepoints": [10806], "characters": "\u2A36" },
    "&ouml": { "codepoints": [246], "characters": "\u00F6" },
    "&ouml;": { "codepoints": [246], "characters": "\u00F6" },
    "&ovbar;": { "codepoints": [9021], "characters": "\u233D" },
    "&par;": { "codepoints": [8741], "characters": "\u2225" },
    "&para": { "codepoints": [182], "characters": "\u00B6" },
    "&para;": { "codepoints": [182], "characters": "\u00B6" },
    "&parallel;": { "codepoints": [8741], "characters": "\u2225" },
    "&parsim;": { "codepoints": [10995], "characters": "\u2AF3" },
    "&parsl;": { "codepoints": [11005], "characters": "\u2AFD" },
    "&part;": { "codepoints": [8706], "characters": "\u2202" },
    "&pcy;": { "codepoints": [1087], "characters": "\u043F" },
    "&percnt;": { "codepoints": [37], "characters": "\u0025" },
    "&period;": { "codepoints": [46], "characters": "\u002E" },
    "&permil;": { "codepoints": [8240], "characters": "\u2030" },
    "&perp;": { "codepoints": [8869], "characters": "\u22A5" },
    "&pertenk;": { "codepoints": [8241], "characters": "\u2031" },
    "&pfr;": { "codepoints": [120109], "characters": "\uD835\uDD2D" },
    "&phi;": { "codepoints": [966], "characters": "\u03C6" },
    "&phiv;": { "codepoints": [981], "characters": "\u03D5" },
    "&phmmat;": { "codepoints": [8499], "characters": "\u2133" },
    "&phone;": { "codepoints": [9742], "characters": "\u260E" },
    "&pi;": { "codepoints": [960], "characters": "\u03C0" },
    "&pitchfork;": { "codepoints": [8916], "characters": "\u22D4" },
    "&piv;": { "codepoints": [982], "characters": "\u03D6" },
    "&planck;": { "codepoints": [8463], "characters": "\u210F" },
    "&planckh;": { "codepoints": [8462], "characters": "\u210E" },
    "&plankv;": { "codepoints": [8463], "characters": "\u210F" },
    "&plus;": { "codepoints": [43], "characters": "\u002B" },
    "&plusacir;": { "codepoints": [10787], "characters": "\u2A23" },
    "&plusb;": { "codepoints": [8862], "characters": "\u229E" },
    "&pluscir;": { "codepoints": [10786], "characters": "\u2A22" },
    "&plusdo;": { "codepoints": [8724], "characters": "\u2214" },
    "&plusdu;": { "codepoints": [10789], "characters": "\u2A25" },
    "&pluse;": { "codepoints": [10866], "characters": "\u2A72" },
    "&plusmn": { "codepoints": [177], "characters": "\u00B1" },
    "&plusmn;": { "codepoints": [177], "characters": "\u00B1" },
    "&plussim;": { "codepoints": [10790], "characters": "\u2A26" },
    "&plustwo;": { "codepoints": [10791], "characters": "\u2A27" },
    "&pm;": { "codepoints": [177], "characters": "\u00B1" },
    "&pointint;": { "codepoints": [10773], "characters": "\u2A15" },
    "&popf;": { "codepoints": [120161], "characters": "\uD835\uDD61" },
    "&pound": { "codepoints": [163], "characters": "\u00A3" },
    "&pound;": { "codepoints": [163], "characters": "\u00A3" },
    "&pr;": { "codepoints": [8826], "characters": "\u227A" },
    "&prE;": { "codepoints": [10931], "characters": "\u2AB3" },
    "&prap;": { "codepoints": [10935], "characters": "\u2AB7" },
    "&prcue;": { "codepoints": [8828], "characters": "\u227C" },
    "&pre;": { "codepoints": [10927], "characters": "\u2AAF" },
    "&prec;": { "codepoints": [8826], "characters": "\u227A" },
    "&precapprox;": { "codepoints": [10935], "characters": "\u2AB7" },
    "&preccurlyeq;": { "codepoints": [8828], "characters": "\u227C" },
    "&preceq;": { "codepoints": [10927], "characters": "\u2AAF" },
    "&precnapprox;": { "codepoints": [10937], "characters": "\u2AB9" },
    "&precneqq;": { "codepoints": [10933], "characters": "\u2AB5" },
    "&precnsim;": { "codepoints": [8936], "characters": "\u22E8" },
    "&precsim;": { "codepoints": [8830], "characters": "\u227E" },
    "&prime;": { "codepoints": [8242], "characters": "\u2032" },
    "&primes;": { "codepoints": [8473], "characters": "\u2119" },
    "&prnE;": { "codepoints": [10933], "characters": "\u2AB5" },
    "&prnap;": { "codepoints": [10937], "characters": "\u2AB9" },
    "&prnsim;": { "codepoints": [8936], "characters": "\u22E8" },
    "&prod;": { "codepoints": [8719], "characters": "\u220F" },
    "&profalar;": { "codepoints": [9006], "characters": "\u232E" },
    "&profline;": { "codepoints": [8978], "characters": "\u2312" },
    "&profsurf;": { "codepoints": [8979], "characters": "\u2313" },
    "&prop;": { "codepoints": [8733], "characters": "\u221D" },
    "&propto;": { "codepoints": [8733], "characters": "\u221D" },
    "&prsim;": { "codepoints": [8830], "characters": "\u227E" },
    "&prurel;": { "codepoints": [8880], "characters": "\u22B0" },
    "&pscr;": { "codepoints": [120005], "characters": "\uD835\uDCC5" },
    "&psi;": { "codepoints": [968], "characters": "\u03C8" },
    "&puncsp;": { "codepoints": [8200], "characters": "\u2008" },
    "&qfr;": { "codepoints": [120110], "characters": "\uD835\uDD2E" },
    "&qint;": { "codepoints": [10764], "characters": "\u2A0C" },
    "&qopf;": { "codepoints": [120162], "characters": "\uD835\uDD62" },
    "&qprime;": { "codepoints": [8279], "characters": "\u2057" },
    "&qscr;": { "codepoints": [120006], "characters": "\uD835\uDCC6" },
    "&quaternions;": { "codepoints": [8461], "characters": "\u210D" },
    "&quatint;": { "codepoints": [10774], "characters": "\u2A16" },
    "&quest;": { "codepoints": [63], "characters": "\u003F" },
    "&questeq;": { "codepoints": [8799], "characters": "\u225F" },
    "&quot": { "codepoints": [34], "characters": "\u0022" },
    "&quot;": { "codepoints": [34], "characters": "\u0022" },
    "&rAarr;": { "codepoints": [8667], "characters": "\u21DB" },
    "&rArr;": { "codepoints": [8658], "characters": "\u21D2" },
    "&rAtail;": { "codepoints": [10524], "characters": "\u291C" },
    "&rBarr;": { "codepoints": [10511], "characters": "\u290F" },
    "&rHar;": { "codepoints": [10596], "characters": "\u2964" },
    "&race;": { "codepoints": [8765, 817], "characters": "\u223D\u0331" },
    "&racute;": { "codepoints": [341], "characters": "\u0155" },
    "&radic;": { "codepoints": [8730], "characters": "\u221A" },
    "&raemptyv;": { "codepoints": [10675], "characters": "\u29B3" },
    "&rang;": { "codepoints": [10217], "characters": "\u27E9" },
    "&rangd;": { "codepoints": [10642], "characters": "\u2992" },
    "&range;": { "codepoints": [10661], "characters": "\u29A5" },
    "&rangle;": { "codepoints": [10217], "characters": "\u27E9" },
    "&raquo": { "codepoints": [187], "characters": "\u00BB" },
    "&raquo;": { "codepoints": [187], "characters": "\u00BB" },
    "&rarr;": { "codepoints": [8594], "characters": "\u2192" },
    "&rarrap;": { "codepoints": [10613], "characters": "\u2975" },
    "&rarrb;": { "codepoints": [8677], "characters": "\u21E5" },
    "&rarrbfs;": { "codepoints": [10528], "characters": "\u2920" },
    "&rarrc;": { "codepoints": [10547], "characters": "\u2933" },
    "&rarrfs;": { "codepoints": [10526], "characters": "\u291E" },
    "&rarrhk;": { "codepoints": [8618], "characters": "\u21AA" },
    "&rarrlp;": { "codepoints": [8620], "characters": "\u21AC" },
    "&rarrpl;": { "codepoints": [10565], "characters": "\u2945" },
    "&rarrsim;": { "codepoints": [10612], "characters": "\u2974" },
    "&rarrtl;": { "codepoints": [8611], "characters": "\u21A3" },
    "&rarrw;": { "codepoints": [8605], "characters": "\u219D" },
    "&ratail;": { "codepoints": [10522], "characters": "\u291A" },
    "&ratio;": { "codepoints": [8758], "characters": "\u2236" },
    "&rationals;": { "codepoints": [8474], "characters": "\u211A" },
    "&rbarr;": { "codepoints": [10509], "characters": "\u290D" },
    "&rbbrk;": { "codepoints": [10099], "characters": "\u2773" },
    "&rbrace;": { "codepoints": [125], "characters": "\u007D" },
    "&rbrack;": { "codepoints": [93], "characters": "\u005D" },
    "&rbrke;": { "codepoints": [10636], "characters": "\u298C" },
    "&rbrksld;": { "codepoints": [10638], "characters": "\u298E" },
    "&rbrkslu;": { "codepoints": [10640], "characters": "\u2990" },
    "&rcaron;": { "codepoints": [345], "characters": "\u0159" },
    "&rcedil;": { "codepoints": [343], "characters": "\u0157" },
    "&rceil;": { "codepoints": [8969], "characters": "\u2309" },
    "&rcub;": { "codepoints": [125], "characters": "\u007D" },
    "&rcy;": { "codepoints": [1088], "characters": "\u0440" },
    "&rdca;": { "codepoints": [10551], "characters": "\u2937" },
    "&rdldhar;": { "codepoints": [10601], "characters": "\u2969" },
    "&rdquo;": { "codepoints": [8221], "characters": "\u201D" },
    "&rdquor;": { "codepoints": [8221], "characters": "\u201D" },
    "&rdsh;": { "codepoints": [8627], "characters": "\u21B3" },
    "&real;": { "codepoints": [8476], "characters": "\u211C" },
    "&realine;": { "codepoints": [8475], "characters": "\u211B" },
    "&realpart;": { "codepoints": [8476], "characters": "\u211C" },
    "&reals;": { "codepoints": [8477], "characters": "\u211D" },
    "&rect;": { "codepoints": [9645], "characters": "\u25AD" },
    "&reg": { "codepoints": [174], "characters": "\u00AE" },
    "&reg;": { "codepoints": [174], "characters": "\u00AE" },
    "&rfisht;": { "codepoints": [10621], "characters": "\u297D" },
    "&rfloor;": { "codepoints": [8971], "characters": "\u230B" },
    "&rfr;": { "codepoints": [120111], "characters": "\uD835\uDD2F" },
    "&rhard;": { "codepoints": [8641], "characters": "\u21C1" },
    "&rharu;": { "codepoints": [8640], "characters": "\u21C0" },
    "&rharul;": { "codepoints": [10604], "characters": "\u296C" },
    "&rho;": { "codepoints": [961], "characters": "\u03C1" },
    "&rhov;": { "codepoints": [1009], "characters": "\u03F1" },
    "&rightarrow;": { "codepoints": [8594], "characters": "\u2192" },
    "&rightarrowtail;": { "codepoints": [8611], "characters": "\u21A3" },
    "&rightharpoondown;": { "codepoints": [8641], "characters": "\u21C1" },
    "&rightharpoonup;": { "codepoints": [8640], "characters": "\u21C0" },
    "&rightleftarrows;": { "codepoints": [8644], "characters": "\u21C4" },
    "&rightleftharpoons;": { "codepoints": [8652], "characters": "\u21CC" },
    "&rightrightarrows;": { "codepoints": [8649], "characters": "\u21C9" },
    "&rightsquigarrow;": { "codepoints": [8605], "characters": "\u219D" },
    "&rightthreetimes;": { "codepoints": [8908], "characters": "\u22CC" },
    "&ring;": { "codepoints": [730], "characters": "\u02DA" },
    "&risingdotseq;": { "codepoints": [8787], "characters": "\u2253" },
    "&rlarr;": { "codepoints": [8644], "characters": "\u21C4" },
    "&rlhar;": { "codepoints": [8652], "characters": "\u21CC" },
    "&rlm;": { "codepoints": [8207], "characters": "\u200F" },
    "&rmoust;": { "codepoints": [9137], "characters": "\u23B1" },
    "&rmoustache;": { "codepoints": [9137], "characters": "\u23B1" },
    "&rnmid;": { "codepoints": [10990], "characters": "\u2AEE" },
    "&roang;": { "codepoints": [10221], "characters": "\u27ED" },
    "&roarr;": { "codepoints": [8702], "characters": "\u21FE" },
    "&robrk;": { "codepoints": [10215], "characters": "\u27E7" },
    "&ropar;": { "codepoints": [10630], "characters": "\u2986" },
    "&ropf;": { "codepoints": [120163], "characters": "\uD835\uDD63" },
    "&roplus;": { "codepoints": [10798], "characters": "\u2A2E" },
    "&rotimes;": { "codepoints": [10805], "characters": "\u2A35" },
    "&rpar;": { "codepoints": [41], "characters": "\u0029" },
    "&rpargt;": { "codepoints": [10644], "characters": "\u2994" },
    "&rppolint;": { "codepoints": [10770], "characters": "\u2A12" },
    "&rrarr;": { "codepoints": [8649], "characters": "\u21C9" },
    "&rsaquo;": { "codepoints": [8250], "characters": "\u203A" },
    "&rscr;": { "codepoints": [120007], "characters": "\uD835\uDCC7" },
    "&rsh;": { "codepoints": [8625], "characters": "\u21B1" },
    "&rsqb;": { "codepoints": [93], "characters": "\u005D" },
    "&rsquo;": { "codepoints": [8217], "characters": "\u2019" },
    "&rsquor;": { "codepoints": [8217], "characters": "\u2019" },
    "&rthree;": { "codepoints": [8908], "characters": "\u22CC" },
    "&rtimes;": { "codepoints": [8906], "characters": "\u22CA" },
    "&rtri;": { "codepoints": [9657], "characters": "\u25B9" },
    "&rtrie;": { "codepoints": [8885], "characters": "\u22B5" },
    "&rtrif;": { "codepoints": [9656], "characters": "\u25B8" },
    "&rtriltri;": { "codepoints": [10702], "characters": "\u29CE" },
    "&ruluhar;": { "codepoints": [10600], "characters": "\u2968" },
    "&rx;": { "codepoints": [8478], "characters": "\u211E" },
    "&sacute;": { "codepoints": [347], "characters": "\u015B" },
    "&sbquo;": { "codepoints": [8218], "characters": "\u201A" },
    "&sc;": { "codepoints": [8827], "characters": "\u227B" },
    "&scE;": { "codepoints": [10932], "characters": "\u2AB4" },
    "&scap;": { "codepoints": [10936], "characters": "\u2AB8" },
    "&scaron;": { "codepoints": [353], "characters": "\u0161" },
    "&sccue;": { "codepoints": [8829], "characters": "\u227D" },
    "&sce;": { "codepoints": [10928], "characters": "\u2AB0" },
    "&scedil;": { "codepoints": [351], "characters": "\u015F" },
    "&scirc;": { "codepoints": [349], "characters": "\u015D" },
    "&scnE;": { "codepoints": [10934], "characters": "\u2AB6" },
    "&scnap;": { "codepoints": [10938], "characters": "\u2ABA" },
    "&scnsim;": { "codepoints": [8937], "characters": "\u22E9" },
    "&scpolint;": { "codepoints": [10771], "characters": "\u2A13" },
    "&scsim;": { "codepoints": [8831], "characters": "\u227F" },
    "&scy;": { "codepoints": [1089], "characters": "\u0441" },
    "&sdot;": { "codepoints": [8901], "characters": "\u22C5" },
    "&sdotb;": { "codepoints": [8865], "characters": "\u22A1" },
    "&sdote;": { "codepoints": [10854], "characters": "\u2A66" },
    "&seArr;": { "codepoints": [8664], "characters": "\u21D8" },
    "&searhk;": { "codepoints": [10533], "characters": "\u2925" },
    "&searr;": { "codepoints": [8600], "characters": "\u2198" },
    "&searrow;": { "codepoints": [8600], "characters": "\u2198" },
    "&sect": { "codepoints": [167], "characters": "\u00A7" },
    "&sect;": { "codepoints": [167], "characters": "\u00A7" },
    "&semi;": { "codepoints": [59], "characters": "\u003B" },
    "&seswar;": { "codepoints": [10537], "characters": "\u2929" },
    "&setminus;": { "codepoints": [8726], "characters": "\u2216" },
    "&setmn;": { "codepoints": [8726], "characters": "\u2216" },
    "&sext;": { "codepoints": [10038], "characters": "\u2736" },
    "&sfr;": { "codepoints": [120112], "characters": "\uD835\uDD30" },
    "&sfrown;": { "codepoints": [8994], "characters": "\u2322" },
    "&sharp;": { "codepoints": [9839], "characters": "\u266F" },
    "&shchcy;": { "codepoints": [1097], "characters": "\u0449" },
    "&shcy;": { "codepoints": [1096], "characters": "\u0448" },
    "&shortmid;": { "codepoints": [8739], "characters": "\u2223" },
    "&shortparallel;": { "codepoints": [8741], "characters": "\u2225" },
    "&shy": { "codepoints": [173], "characters": "\u00AD" },
    "&shy;": { "codepoints": [173], "characters": "\u00AD" },
    "&sigma;": { "codepoints": [963], "characters": "\u03C3" },
    "&sigmaf;": { "codepoints": [962], "characters": "\u03C2" },
    "&sigmav;": { "codepoints": [962], "characters": "\u03C2" },
    "&sim;": { "codepoints": [8764], "characters": "\u223C" },
    "&simdot;": { "codepoints": [10858], "characters": "\u2A6A" },
    "&sime;": { "codepoints": [8771], "characters": "\u2243" },
    "&simeq;": { "codepoints": [8771], "characters": "\u2243" },
    "&simg;": { "codepoints": [10910], "characters": "\u2A9E" },
    "&simgE;": { "codepoints": [10912], "characters": "\u2AA0" },
    "&siml;": { "codepoints": [10909], "characters": "\u2A9D" },
    "&simlE;": { "codepoints": [10911], "characters": "\u2A9F" },
    "&simne;": { "codepoints": [8774], "characters": "\u2246" },
    "&simplus;": { "codepoints": [10788], "characters": "\u2A24" },
    "&simrarr;": { "codepoints": [10610], "characters": "\u2972" },
    "&slarr;": { "codepoints": [8592], "characters": "\u2190" },
    "&smallsetminus;": { "codepoints": [8726], "characters": "\u2216" },
    "&smashp;": { "codepoints": [10803], "characters": "\u2A33" },
    "&smeparsl;": { "codepoints": [10724], "characters": "\u29E4" },
    "&smid;": { "codepoints": [8739], "characters": "\u2223" },
    "&smile;": { "codepoints": [8995], "characters": "\u2323" },
    "&smt;": { "codepoints": [10922], "characters": "\u2AAA" },
    "&smte;": { "codepoints": [10924], "characters": "\u2AAC" },
    "&smtes;": { "codepoints": [10924, 65024], "characters": "\u2AAC\uFE00" },
    "&softcy;": { "codepoints": [1100], "characters": "\u044C" },
    "&sol;": { "codepoints": [47], "characters": "\u002F" },
    "&solb;": { "codepoints": [10692], "characters": "\u29C4" },
    "&solbar;": { "codepoints": [9023], "characters": "\u233F" },
    "&sopf;": { "codepoints": [120164], "characters": "\uD835\uDD64" },
    "&spades;": { "codepoints": [9824], "characters": "\u2660" },
    "&spadesuit;": { "codepoints": [9824], "characters": "\u2660" },
    "&spar;": { "codepoints": [8741], "characters": "\u2225" },
    "&sqcap;": { "codepoints": [8851], "characters": "\u2293" },
    "&sqcaps;": { "codepoints": [8851, 65024], "characters": "\u2293\uFE00" },
    "&sqcup;": { "codepoints": [8852], "characters": "\u2294" },
    "&sqcups;": { "codepoints": [8852, 65024], "characters": "\u2294\uFE00" },
    "&sqsub;": { "codepoints": [8847], "characters": "\u228F" },
    "&sqsube;": { "codepoints": [8849], "characters": "\u2291" },
    "&sqsubset;": { "codepoints": [8847], "characters": "\u228F" },
    "&sqsubseteq;": { "codepoints": [8849], "characters": "\u2291" },
    "&sqsup;": { "codepoints": [8848], "characters": "\u2290" },
    "&sqsupe;": { "codepoints": [8850], "characters": "\u2292" },
    "&sqsupset;": { "codepoints": [8848], "characters": "\u2290" },
    "&sqsupseteq;": { "codepoints": [8850], "characters": "\u2292" },
    "&squ;": { "codepoints": [9633], "characters": "\u25A1" },
    "&square;": { "codepoints": [9633], "characters": "\u25A1" },
    "&squarf;": { "codepoints": [9642], "characters": "\u25AA" },
    "&squf;": { "codepoints": [9642], "characters": "\u25AA" },
    "&srarr;": { "codepoints": [8594], "characters": "\u2192" },
    "&sscr;": { "codepoints": [120008], "characters": "\uD835\uDCC8" },
    "&ssetmn;": { "codepoints": [8726], "characters": "\u2216" },
    "&ssmile;": { "codepoints": [8995], "characters": "\u2323" },
    "&sstarf;": { "codepoints": [8902], "characters": "\u22C6" },
    "&star;": { "codepoints": [9734], "characters": "\u2606" },
    "&starf;": { "codepoints": [9733], "characters": "\u2605" },
    "&straightepsilon;": { "codepoints": [1013], "characters": "\u03F5" },
    "&straightphi;": { "codepoints": [981], "characters": "\u03D5" },
    "&strns;": { "codepoints": [175], "characters": "\u00AF" },
    "&sub;": { "codepoints": [8834], "characters": "\u2282" },
    "&subE;": { "codepoints": [10949], "characters": "\u2AC5" },
    "&subdot;": { "codepoints": [10941], "characters": "\u2ABD" },
    "&sube;": { "codepoints": [8838], "characters": "\u2286" },
    "&subedot;": { "codepoints": [10947], "characters": "\u2AC3" },
    "&submult;": { "codepoints": [10945], "characters": "\u2AC1" },
    "&subnE;": { "codepoints": [10955], "characters": "\u2ACB" },
    "&subne;": { "codepoints": [8842], "characters": "\u228A" },
    "&subplus;": { "codepoints": [10943], "characters": "\u2ABF" },
    "&subrarr;": { "codepoints": [10617], "characters": "\u2979" },
    "&subset;": { "codepoints": [8834], "characters": "\u2282" },
    "&subseteq;": { "codepoints": [8838], "characters": "\u2286" },
    "&subseteqq;": { "codepoints": [10949], "characters": "\u2AC5" },
    "&subsetneq;": { "codepoints": [8842], "characters": "\u228A" },
    "&subsetneqq;": { "codepoints": [10955], "characters": "\u2ACB" },
    "&subsim;": { "codepoints": [10951], "characters": "\u2AC7" },
    "&subsub;": { "codepoints": [10965], "characters": "\u2AD5" },
    "&subsup;": { "codepoints": [10963], "characters": "\u2AD3" },
    "&succ;": { "codepoints": [8827], "characters": "\u227B" },
    "&succapprox;": { "codepoints": [10936], "characters": "\u2AB8" },
    "&succcurlyeq;": { "codepoints": [8829], "characters": "\u227D" },
    "&succeq;": { "codepoints": [10928], "characters": "\u2AB0" },
    "&succnapprox;": { "codepoints": [10938], "characters": "\u2ABA" },
    "&succneqq;": { "codepoints": [10934], "characters": "\u2AB6" },
    "&succnsim;": { "codepoints": [8937], "characters": "\u22E9" },
    "&succsim;": { "codepoints": [8831], "characters": "\u227F" },
    "&sum;": { "codepoints": [8721], "characters": "\u2211" },
    "&sung;": { "codepoints": [9834], "characters": "\u266A" },
    "&sup1": { "codepoints": [185], "characters": "\u00B9" },
    "&sup1;": { "codepoints": [185], "characters": "\u00B9" },
    "&sup2": { "codepoints": [178], "characters": "\u00B2" },
    "&sup2;": { "codepoints": [178], "characters": "\u00B2" },
    "&sup3": { "codepoints": [179], "characters": "\u00B3" },
    "&sup3;": { "codepoints": [179], "characters": "\u00B3" },
    "&sup;": { "codepoints": [8835], "characters": "\u2283" },
    "&supE;": { "codepoints": [10950], "characters": "\u2AC6" },
    "&supdot;": { "codepoints": [10942], "characters": "\u2ABE" },
    "&supdsub;": { "codepoints": [10968], "characters": "\u2AD8" },
    "&supe;": { "codepoints": [8839], "characters": "\u2287" },
    "&supedot;": { "codepoints": [10948], "characters": "\u2AC4" },
    "&suphsol;": { "codepoints": [10185], "characters": "\u27C9" },
    "&suphsub;": { "codepoints": [10967], "characters": "\u2AD7" },
    "&suplarr;": { "codepoints": [10619], "characters": "\u297B" },
    "&supmult;": { "codepoints": [10946], "characters": "\u2AC2" },
    "&supnE;": { "codepoints": [10956], "characters": "\u2ACC" },
    "&supne;": { "codepoints": [8843], "characters": "\u228B" },
    "&supplus;": { "codepoints": [10944], "characters": "\u2AC0" },
    "&supset;": { "codepoints": [8835], "characters": "\u2283" },
    "&supseteq;": { "codepoints": [8839], "characters": "\u2287" },
    "&supseteqq;": { "codepoints": [10950], "characters": "\u2AC6" },
    "&supsetneq;": { "codepoints": [8843], "characters": "\u228B" },
    "&supsetneqq;": { "codepoints": [10956], "characters": "\u2ACC" },
    "&supsim;": { "codepoints": [10952], "characters": "\u2AC8" },
    "&supsub;": { "codepoints": [10964], "characters": "\u2AD4" },
    "&supsup;": { "codepoints": [10966], "characters": "\u2AD6" },
    "&swArr;": { "codepoints": [8665], "characters": "\u21D9" },
    "&swarhk;": { "codepoints": [10534], "characters": "\u2926" },
    "&swarr;": { "codepoints": [8601], "characters": "\u2199" },
    "&swarrow;": { "codepoints": [8601], "characters": "\u2199" },
    "&swnwar;": { "codepoints": [10538], "characters": "\u292A" },
    "&szlig": { "codepoints": [223], "characters": "\u00DF" },
    "&szlig;": { "codepoints": [223], "characters": "\u00DF" },
    "&target;": { "codepoints": [8982], "characters": "\u2316" },
    "&tau;": { "codepoints": [964], "characters": "\u03C4" },
    "&tbrk;": { "codepoints": [9140], "characters": "\u23B4" },
    "&tcaron;": { "codepoints": [357], "characters": "\u0165" },
    "&tcedil;": { "codepoints": [355], "characters": "\u0163" },
    "&tcy;": { "codepoints": [1090], "characters": "\u0442" },
    "&tdot;": { "codepoints": [8411], "characters": "\u20DB" },
    "&telrec;": { "codepoints": [8981], "characters": "\u2315" },
    "&tfr;": { "codepoints": [120113], "characters": "\uD835\uDD31" },
    "&there4;": { "codepoints": [8756], "characters": "\u2234" },
    "&therefore;": { "codepoints": [8756], "characters": "\u2234" },
    "&theta;": { "codepoints": [952], "characters": "\u03B8" },
    "&thetasym;": { "codepoints": [977], "characters": "\u03D1" },
    "&thetav;": { "codepoints": [977], "characters": "\u03D1" },
    "&thickapprox;": { "codepoints": [8776], "characters": "\u2248" },
    "&thicksim;": { "codepoints": [8764], "characters": "\u223C" },
    "&thinsp;": { "codepoints": [8201], "characters": "\u2009" },
    "&thkap;": { "codepoints": [8776], "characters": "\u2248" },
    "&thksim;": { "codepoints": [8764], "characters": "\u223C" },
    "&thorn": { "codepoints": [254], "characters": "\u00FE" },
    "&thorn;": { "codepoints": [254], "characters": "\u00FE" },
    "&tilde;": { "codepoints": [732], "characters": "\u02DC" },
    "&times": { "codepoints": [215], "characters": "\u00D7" },
    "&times;": { "codepoints": [215], "characters": "\u00D7" },
    "&timesb;": { "codepoints": [8864], "characters": "\u22A0" },
    "&timesbar;": { "codepoints": [10801], "characters": "\u2A31" },
    "&timesd;": { "codepoints": [10800], "characters": "\u2A30" },
    "&tint;": { "codepoints": [8749], "characters": "\u222D" },
    "&toea;": { "codepoints": [10536], "characters": "\u2928" },
    "&top;": { "codepoints": [8868], "characters": "\u22A4" },
    "&topbot;": { "codepoints": [9014], "characters": "\u2336" },
    "&topcir;": { "codepoints": [10993], "characters": "\u2AF1" },
    "&topf;": { "codepoints": [120165], "characters": "\uD835\uDD65" },
    "&topfork;": { "codepoints": [10970], "characters": "\u2ADA" },
    "&tosa;": { "codepoints": [10537], "characters": "\u2929" },
    "&tprime;": { "codepoints": [8244], "characters": "\u2034" },
    "&trade;": { "codepoints": [8482], "characters": "\u2122" },
    "&triangle;": { "codepoints": [9653], "characters": "\u25B5" },
    "&triangledown;": { "codepoints": [9663], "characters": "\u25BF" },
    "&triangleleft;": { "codepoints": [9667], "characters": "\u25C3" },
    "&trianglelefteq;": { "codepoints": [8884], "characters": "\u22B4" },
    "&triangleq;": { "codepoints": [8796], "characters": "\u225C" },
    "&triangleright;": { "codepoints": [9657], "characters": "\u25B9" },
    "&trianglerighteq;": { "codepoints": [8885], "characters": "\u22B5" },
    "&tridot;": { "codepoints": [9708], "characters": "\u25EC" },
    "&trie;": { "codepoints": [8796], "characters": "\u225C" },
    "&triminus;": { "codepoints": [10810], "characters": "\u2A3A" },
    "&triplus;": { "codepoints": [10809], "characters": "\u2A39" },
    "&trisb;": { "codepoints": [10701], "characters": "\u29CD" },
    "&tritime;": { "codepoints": [10811], "characters": "\u2A3B" },
    "&trpezium;": { "codepoints": [9186], "characters": "\u23E2" },
    "&tscr;": { "codepoints": [120009], "characters": "\uD835\uDCC9" },
    "&tscy;": { "codepoints": [1094], "characters": "\u0446" },
    "&tshcy;": { "codepoints": [1115], "characters": "\u045B" },
    "&tstrok;": { "codepoints": [359], "characters": "\u0167" },
    "&twixt;": { "codepoints": [8812], "characters": "\u226C" },
    "&twoheadleftarrow;": { "codepoints": [8606], "characters": "\u219E" },
    "&twoheadrightarrow;": { "codepoints": [8608], "characters": "\u21A0" },
    "&uArr;": { "codepoints": [8657], "characters": "\u21D1" },
    "&uHar;": { "codepoints": [10595], "characters": "\u2963" },
    "&uacute": { "codepoints": [250], "characters": "\u00FA" },
    "&uacute;": { "codepoints": [250], "characters": "\u00FA" },
    "&uarr;": { "codepoints": [8593], "characters": "\u2191" },
    "&ubrcy;": { "codepoints": [1118], "characters": "\u045E" },
    "&ubreve;": { "codepoints": [365], "characters": "\u016D" },
    "&ucirc": { "codepoints": [251], "characters": "\u00FB" },
    "&ucirc;": { "codepoints": [251], "characters": "\u00FB" },
    "&ucy;": { "codepoints": [1091], "characters": "\u0443" },
    "&udarr;": { "codepoints": [8645], "characters": "\u21C5" },
    "&udblac;": { "codepoints": [369], "characters": "\u0171" },
    "&udhar;": { "codepoints": [10606], "characters": "\u296E" },
    "&ufisht;": { "codepoints": [10622], "characters": "\u297E" },
    "&ufr;": { "codepoints": [120114], "characters": "\uD835\uDD32" },
    "&ugrave": { "codepoints": [249], "characters": "\u00F9" },
    "&ugrave;": { "codepoints": [249], "characters": "\u00F9" },
    "&uharl;": { "codepoints": [8639], "characters": "\u21BF" },
    "&uharr;": { "codepoints": [8638], "characters": "\u21BE" },
    "&uhblk;": { "codepoints": [9600], "characters": "\u2580" },
    "&ulcorn;": { "codepoints": [8988], "characters": "\u231C" },
    "&ulcorner;": { "codepoints": [8988], "characters": "\u231C" },
    "&ulcrop;": { "codepoints": [8975], "characters": "\u230F" },
    "&ultri;": { "codepoints": [9720], "characters": "\u25F8" },
    "&umacr;": { "codepoints": [363], "characters": "\u016B" },
    "&uml": { "codepoints": [168], "characters": "\u00A8" },
    "&uml;": { "codepoints": [168], "characters": "\u00A8" },
    "&uogon;": { "codepoints": [371], "characters": "\u0173" },
    "&uopf;": { "codepoints": [120166], "characters": "\uD835\uDD66" },
    "&uparrow;": { "codepoints": [8593], "characters": "\u2191" },
    "&updownarrow;": { "codepoints": [8597], "characters": "\u2195" },
    "&upharpoonleft;": { "codepoints": [8639], "characters": "\u21BF" },
    "&upharpoonright;": { "codepoints": [8638], "characters": "\u21BE" },
    "&uplus;": { "codepoints": [8846], "characters": "\u228E" },
    "&upsi;": { "codepoints": [965], "characters": "\u03C5" },
    "&upsih;": { "codepoints": [978], "characters": "\u03D2" },
    "&upsilon;": { "codepoints": [965], "characters": "\u03C5" },
    "&upuparrows;": { "codepoints": [8648], "characters": "\u21C8" },
    "&urcorn;": { "codepoints": [8989], "characters": "\u231D" },
    "&urcorner;": { "codepoints": [8989], "characters": "\u231D" },
    "&urcrop;": { "codepoints": [8974], "characters": "\u230E" },
    "&uring;": { "codepoints": [367], "characters": "\u016F" },
    "&urtri;": { "codepoints": [9721], "characters": "\u25F9" },
    "&uscr;": { "codepoints": [120010], "characters": "\uD835\uDCCA" },
    "&utdot;": { "codepoints": [8944], "characters": "\u22F0" },
    "&utilde;": { "codepoints": [361], "characters": "\u0169" },
    "&utri;": { "codepoints": [9653], "characters": "\u25B5" },
    "&utrif;": { "codepoints": [9652], "characters": "\u25B4" },
    "&uuarr;": { "codepoints": [8648], "characters": "\u21C8" },
    "&uuml": { "codepoints": [252], "characters": "\u00FC" },
    "&uuml;": { "codepoints": [252], "characters": "\u00FC" },
    "&uwangle;": { "codepoints": [10663], "characters": "\u29A7" },
    "&vArr;": { "codepoints": [8661], "characters": "\u21D5" },
    "&vBar;": { "codepoints": [10984], "characters": "\u2AE8" },
    "&vBarv;": { "codepoints": [10985], "characters": "\u2AE9" },
    "&vDash;": { "codepoints": [8872], "characters": "\u22A8" },
    "&vangrt;": { "codepoints": [10652], "characters": "\u299C" },
    "&varepsilon;": { "codepoints": [1013], "characters": "\u03F5" },
    "&varkappa;": { "codepoints": [1008], "characters": "\u03F0" },
    "&varnothing;": { "codepoints": [8709], "characters": "\u2205" },
    "&varphi;": { "codepoints": [981], "characters": "\u03D5" },
    "&varpi;": { "codepoints": [982], "characters": "\u03D6" },
    "&varpropto;": { "codepoints": [8733], "characters": "\u221D" },
    "&varr;": { "codepoints": [8597], "characters": "\u2195" },
    "&varrho;": { "codepoints": [1009], "characters": "\u03F1" },
    "&varsigma;": { "codepoints": [962], "characters": "\u03C2" },
    "&varsubsetneq;": { "codepoints": [8842, 65024], "characters": "\u228A\uFE00" },
    "&varsubsetneqq;": { "codepoints": [10955, 65024], "characters": "\u2ACB\uFE00" },
    "&varsupsetneq;": { "codepoints": [8843, 65024], "characters": "\u228B\uFE00" },
    "&varsupsetneqq;": { "codepoints": [10956, 65024], "characters": "\u2ACC\uFE00" },
    "&vartheta;": { "codepoints": [977], "characters": "\u03D1" },
    "&vartriangleleft;": { "codepoints": [8882], "characters": "\u22B2" },
    "&vartriangleright;": { "codepoints": [8883], "characters": "\u22B3" },
    "&vcy;": { "codepoints": [1074], "characters": "\u0432" },
    "&vdash;": { "codepoints": [8866], "characters": "\u22A2" },
    "&vee;": { "codepoints": [8744], "characters": "\u2228" },
    "&veebar;": { "codepoints": [8891], "characters": "\u22BB" },
    "&veeeq;": { "codepoints": [8794], "characters": "\u225A" },
    "&vellip;": { "codepoints": [8942], "characters": "\u22EE" },
    "&verbar;": { "codepoints": [124], "characters": "\u007C" },
    "&vert;": { "codepoints": [124], "characters": "\u007C" },
    "&vfr;": { "codepoints": [120115], "characters": "\uD835\uDD33" },
    "&vltri;": { "codepoints": [8882], "characters": "\u22B2" },
    "&vnsub;": { "codepoints": [8834, 8402], "characters": "\u2282\u20D2" },
    "&vnsup;": { "codepoints": [8835, 8402], "characters": "\u2283\u20D2" },
    "&vopf;": { "codepoints": [120167], "characters": "\uD835\uDD67" },
    "&vprop;": { "codepoints": [8733], "characters": "\u221D" },
    "&vrtri;": { "codepoints": [8883], "characters": "\u22B3" },
    "&vscr;": { "codepoints": [120011], "characters": "\uD835\uDCCB" },
    "&vsubnE;": { "codepoints": [10955, 65024], "characters": "\u2ACB\uFE00" },
    "&vsubne;": { "codepoints": [8842, 65024], "characters": "\u228A\uFE00" },
    "&vsupnE;": { "codepoints": [10956, 65024], "characters": "\u2ACC\uFE00" },
    "&vsupne;": { "codepoints": [8843, 65024], "characters": "\u228B\uFE00" },
    "&vzigzag;": { "codepoints": [10650], "characters": "\u299A" },
    "&wcirc;": { "codepoints": [373], "characters": "\u0175" },
    "&wedbar;": { "codepoints": [10847], "characters": "\u2A5F" },
    "&wedge;": { "codepoints": [8743], "characters": "\u2227" },
    "&wedgeq;": { "codepoints": [8793], "characters": "\u2259" },
    "&weierp;": { "codepoints": [8472], "characters": "\u2118" },
    "&wfr;": { "codepoints": [120116], "characters": "\uD835\uDD34" },
    "&wopf;": { "codepoints": [120168], "characters": "\uD835\uDD68" },
    "&wp;": { "codepoints": [8472], "characters": "\u2118" },
    "&wr;": { "codepoints": [8768], "characters": "\u2240" },
    "&wreath;": { "codepoints": [8768], "characters": "\u2240" },
    "&wscr;": { "codepoints": [120012], "characters": "\uD835\uDCCC" },
    "&xcap;": { "codepoints": [8898], "characters": "\u22C2" },
    "&xcirc;": { "codepoints": [9711], "characters": "\u25EF" },
    "&xcup;": { "codepoints": [8899], "characters": "\u22C3" },
    "&xdtri;": { "codepoints": [9661], "characters": "\u25BD" },
    "&xfr;": { "codepoints": [120117], "characters": "\uD835\uDD35" },
    "&xhArr;": { "codepoints": [10234], "characters": "\u27FA" },
    "&xharr;": { "codepoints": [10231], "characters": "\u27F7" },
    "&xi;": { "codepoints": [958], "characters": "\u03BE" },
    "&xlArr;": { "codepoints": [10232], "characters": "\u27F8" },
    "&xlarr;": { "codepoints": [10229], "characters": "\u27F5" },
    "&xmap;": { "codepoints": [10236], "characters": "\u27FC" },
    "&xnis;": { "codepoints": [8955], "characters": "\u22FB" },
    "&xodot;": { "codepoints": [10752], "characters": "\u2A00" },
    "&xopf;": { "codepoints": [120169], "characters": "\uD835\uDD69" },
    "&xoplus;": { "codepoints": [10753], "characters": "\u2A01" },
    "&xotime;": { "codepoints": [10754], "characters": "\u2A02" },
    "&xrArr;": { "codepoints": [10233], "characters": "\u27F9" },
    "&xrarr;": { "codepoints": [10230], "characters": "\u27F6" },
    "&xscr;": { "codepoints": [120013], "characters": "\uD835\uDCCD" },
    "&xsqcup;": { "codepoints": [10758], "characters": "\u2A06" },
    "&xuplus;": { "codepoints": [10756], "characters": "\u2A04" },
    "&xutri;": { "codepoints": [9651], "characters": "\u25B3" },
    "&xvee;": { "codepoints": [8897], "characters": "\u22C1" },
    "&xwedge;": { "codepoints": [8896], "characters": "\u22C0" },
    "&yacute": { "codepoints": [253], "characters": "\u00FD" },
    "&yacute;": { "codepoints": [253], "characters": "\u00FD" },
    "&yacy;": { "codepoints": [1103], "characters": "\u044F" },
    "&ycirc;": { "codepoints": [375], "characters": "\u0177" },
    "&ycy;": { "codepoints": [1099], "characters": "\u044B" },
    "&yen": { "codepoints": [165], "characters": "\u00A5" },
    "&yen;": { "codepoints": [165], "characters": "\u00A5" },
    "&yfr;": { "codepoints": [120118], "characters": "\uD835\uDD36" },
    "&yicy;": { "codepoints": [1111], "characters": "\u0457" },
    "&yopf;": { "codepoints": [120170], "characters": "\uD835\uDD6A" },
    "&yscr;": { "codepoints": [120014], "characters": "\uD835\uDCCE" },
    "&yucy;": { "codepoints": [1102], "characters": "\u044E" },
    "&yuml": { "codepoints": [255], "characters": "\u00FF" },
    "&yuml;": { "codepoints": [255], "characters": "\u00FF" },
    "&zacute;": { "codepoints": [378], "characters": "\u017A" },
    "&zcaron;": { "codepoints": [382], "characters": "\u017E" },
    "&zcy;": { "codepoints": [1079], "characters": "\u0437" },
    "&zdot;": { "codepoints": [380], "characters": "\u017C" },
    "&zeetrf;": { "codepoints": [8488], "characters": "\u2128" },
    "&zeta;": { "codepoints": [950], "characters": "\u03B6" },
    "&zfr;": { "codepoints": [120119], "characters": "\uD835\uDD37" },
    "&zhcy;": { "codepoints": [1078], "characters": "\u0436" },
    "&zigrarr;": { "codepoints": [8669], "characters": "\u21DD" },
    "&zopf;": { "codepoints": [120171], "characters": "\uD835\uDD6B" },
    "&zscr;": { "codepoints": [120015], "characters": "\uD835\uDCCF" },
    "&zwj;": { "codepoints": [8205], "characters": "\u200D" },
    "&zwnj;": { "codepoints": [8204], "characters": "\u200C" }
});
define("file:///home/sdorries/repos/github/he/src/scripts/export-data", ["require", "exports", "file:///home/sdorries/repos/github/he/src/deps", "file:///home/sdorries/repos/github/he/src/data/regex-ascii-whitelist", "file:///home/sdorries/repos/github/he/src/data/regex-astral-symbol", "file:///home/sdorries/repos/github/he/src/data/regex-bmp-whitelist", "file:///home/sdorries/repos/github/he/src/data/regex-encode-non-ascii", "file:///home/sdorries/repos/github/he/src/data/regex-invalid-raw-code-points", "file:///home/sdorries/repos/github/he/src/data/regex-legacy-reference", "file:///home/sdorries/repos/github/he/src/data/regex-named-reference", "file:///home/sdorries/repos/github/he/src/data/invalid-code-points-string", "file:///home/sdorries/repos/github/he/src/data/decode-map", "file:///home/sdorries/repos/github/he/src/data/decode-map-legacy", "file:///home/sdorries/repos/github/he/src/data/decode-map-overrides", "file:///home/sdorries/repos/github/he/src/data/encode-map", "file:///home/sdorries/repos/github/he/src/data/invalid-character-reference-code-points", "file:///home/sdorries/repos/github/he/src/data/entities"], function (require, exports, deps_ts_2, regex_ascii_whitelist_json_1, regex_astral_symbol_json_1, regex_bmp_whitelist_json_1, regex_encode_non_ascii_json_1, regex_invalid_raw_code_points_json_1, regex_legacy_reference_json_1, regex_named_reference_json_1, invalid_code_points_string_json_1, decode_map_json_1, decode_map_legacy_json_1, decode_map_overrides_json_1, encode_map_json_1, invalid_character_reference_code_points_json_1, entities_json_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    regex_ascii_whitelist_json_1 = __importDefault(regex_ascii_whitelist_json_1);
    regex_astral_symbol_json_1 = __importDefault(regex_astral_symbol_json_1);
    regex_bmp_whitelist_json_1 = __importDefault(regex_bmp_whitelist_json_1);
    regex_encode_non_ascii_json_1 = __importDefault(regex_encode_non_ascii_json_1);
    regex_invalid_raw_code_points_json_1 = __importDefault(regex_invalid_raw_code_points_json_1);
    regex_legacy_reference_json_1 = __importDefault(regex_legacy_reference_json_1);
    regex_named_reference_json_1 = __importDefault(regex_named_reference_json_1);
    invalid_code_points_string_json_1 = __importDefault(invalid_code_points_string_json_1);
    decode_map_json_1 = __importDefault(decode_map_json_1);
    decode_map_legacy_json_1 = __importDefault(decode_map_legacy_json_1);
    decode_map_overrides_json_1 = __importDefault(decode_map_overrides_json_1);
    encode_map_json_1 = __importDefault(encode_map_json_1);
    invalid_character_reference_code_points_json_1 = __importDefault(invalid_character_reference_code_points_json_1);
    entities_json_1 = __importDefault(entities_json_1);
    const regexDecimalEscapeSource = "&#([0-9]+)(;?)";
    const regexHexadecimalEscapeSource = "&#[xX]([a-fA-F0-9]+)(;?)";
    const regexAmbiguousAmpersand = "&([0-9a-zA-Z]+)";
    const formatJSON = function (object) {
        return deps_ts_2.jsesc(object, {
            compact: true,
            quotes: "single"
        });
    };
    exports.default = {
        decodeMap: decode_map_json_1.default,
        decodeMapLegacy: decode_map_legacy_json_1.default,
        decodeMapOverrides: decode_map_overrides_json_1.default,
        encodeMap: encode_map_json_1.default,
        invalidReferenceCodePoints: invalid_character_reference_code_points_json_1.default,
        testDataMap: entities_json_1.default,
        regexDecimalEscapeSource,
        regexHexadecimalEscapeSource,
        regexAmbiguousAmpersand,
        /**
         * All ASCII symbols (not just printable ASCII) except those listed in the
         * first column of the overrides table.
         * https://html.spec.whatwg.org/multipage/syntax.html#table-charref-overrides
         */
        regexAsciiWhitelist: new RegExp(regex_ascii_whitelist_json_1.default, "g"),
        regexAstralSymbols: new RegExp(regex_astral_symbol_json_1.default, "g"),
        /**
         * All BMP symbols that are not ASCII newlines, printable ASCII symbols, or
         * code points listed in the first column of the overrides table on
         * https://html.spec.whatwg.org/multipage/syntax.html#table-charref-overrides.
         */
        regexBmpWhitelist: new RegExp(regex_bmp_whitelist_json_1.default, "g"),
        regexEncodeNonAscii: new RegExp(regex_encode_non_ascii_json_1.default, "g"),
        regexInvalidRawCodePoints: new RegExp(regex_invalid_raw_code_points_json_1.default),
        regexLegacyReferenceSource: new RegExp(regex_legacy_reference_json_1.default, "g"),
        regexNamedReferenceSource: new RegExp(regex_named_reference_json_1.default, "g"),
        stringInvalidCodePoints: new RegExp(invalid_code_points_string_json_1.default, "g"),
        regexDecode: new RegExp(`${regex_named_reference_json_1.default}|${regex_legacy_reference_json_1.default}|${regexDecimalEscapeSource}|${regexHexadecimalEscapeSource}|${regexAmbiguousAmpersand}`, "g"),
        version: "1.0.0"
    };
});
define("file:///home/sdorries/repos/github/he/src/he", ["require", "exports", "file:///home/sdorries/repos/github/he/src/scripts/export-data"], function (require, exports, export_data_ts_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    export_data_ts_1 = __importDefault(export_data_ts_1);
    const { decodeMap, decodeMapLegacy, decodeMapOverrides, encodeMap, invalidReferenceCodePoints, testDataMap, regexDecimalEscapeSource, regexHexadecimalEscapeSource, regexAmbiguousAmpersand, regexAsciiWhitelist, regexAstralSymbols, regexBmpWhitelist, regexEncodeNonAscii, regexInvalidRawCodePoints, regexLegacyReferenceSource, regexNamedReferenceSource, stringInvalidCodePoints, regexDecode, version } = export_data_ts_1.default;
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
    const object = {};
    const hasOwnProperty = object.hasOwnProperty;
    function has(object, propertyName) {
        return hasOwnProperty.call(object, propertyName);
    }
    function contains(array, value) {
        return array.includes(value, 0);
    }
    // Modified version of `ucs2encode`; see https://mths.be/punycode.
    function codePointToSymbol(codePoint, strict) {
        var output = "";
        if ((codePoint >= 0xd800 && codePoint <= 0xdfff) || codePoint > 0x10ffff) {
            // See issue #4:
            // “Otherwise, if the number is in the range 0xD800 to 0xDFFF or is
            // greater than 0x10FFFF, then this is a parse error. Return a U+FFFD
            // REPLACEMENT CHARACTER.”
            if (strict) {
                parseError("character reference outside the permissible Unicode range");
            }
            return "\uFFFD";
        }
        if (has(decodeMapOverrides, codePoint)) {
            if (strict) {
                parseError("disallowed character reference");
            }
            return decodeMapOverrides[codePoint];
        }
        if (strict && contains(invalidReferenceCodePoints, codePoint)) {
            parseError("disallowed character reference");
        }
        if (codePoint > 0xffff) {
            codePoint -= 0x10000;
            output += stringFromCharCode(((codePoint >>> 10) & 0x3ff) | 0xd800);
            codePoint = 0xdc00 | (codePoint & 0x3ff);
        }
        output += stringFromCharCode(codePoint);
        return output;
    }
    function hexEscape(codePoint) {
        return "&#x" + codePoint.toString(16).toUpperCase() + ";";
    }
    ;
    function decEscape(codePoint) {
        return "&#" + codePoint + ";";
    }
    ;
    function parseError(message) {
        throw Error("Parse error: " + message);
    }
    ;
    /*--------------------------------------------------------------------------*/
    const defaultEncodeOptions = {
        allowUnsafeSymbols: false,
        encodeEverything: false,
        strict: false,
        useNamedReferences: false,
        decimal: false
    };
    function encode(string, options = defaultEncodeOptions) {
        options = { ...options, ...defaultEncodeOptions };
        const escapeCodePoint = options.decimal ? decEscape : hexEscape;
        const { encodeEverything, strict, useNamedReferences, allowUnsafeSymbols } = options;
        if (strict && regexInvalidRawCodePoint.test(string)) {
            parseError("forbidden code point");
        }
        var escapeBmpSymbol = function (symbol) {
            return escapeCodePoint(symbol.charCodeAt(0));
        };
        if (encodeEverything) {
            // Encode ASCII symbols.
            string = string.replace(regexAsciiWhitelist, function (symbol) {
                // Use named references if requested & possible.
                if (useNamedReferences && has(encodeMap, symbol)) {
                    return "&" + encodeMap[symbol] + ";";
                }
                return escapeBmpSymbol(symbol);
            });
            // Shorten a few escapes that represent two symbols, of which at least one
            // is within the ASCII range.
            if (useNamedReferences) {
                string = string
                    .replace(/&gt;\u20D2/g, "&nvgt;")
                    .replace(/&lt;\u20D2/g, "&nvlt;")
                    .replace(/&#x66;&#x6A;/g, "&fjlig;");
            }
            // Encode non-ASCII symbols.
            if (useNamedReferences) {
                // Encode non-ASCII symbols that can be replaced with a named reference.
                string = string.replace(regexEncodeNonAscii, function (string) {
                    // Note: there is no need to check `has(encodeMap, string)` here.
                    return "&" + encodeMap[string] + ";";
                });
            }
            // Note: any remaining non-ASCII symbols are handled outside of the `if`.
        }
        else if (useNamedReferences) {
            // Apply named character references.
            // Encode `<>"'&` using named character references.
            if (!allowUnsafeSymbols) {
                string = string.replace(regexEscape, function (string) {
                    return "&" + encodeMap[string] + ";"; // no need to check `has()` here
                });
            }
            // Shorten escapes that represent two symbols, of which at least one is
            // `<>"'&`.
            string = string
                .replace(/&gt;\u20D2/g, "&nvgt;")
                .replace(/&lt;\u20D2/g, "&nvlt;");
            // Encode non-ASCII symbols that can be replaced with a named reference.
            string = string.replace(regexEncodeNonAscii, function (string) {
                // Note: there is no need to check `has(encodeMap, string)` here.
                return "&" + encodeMap[string] + ";";
            });
        }
        else if (!allowUnsafeSymbols) {
            // Encode `<>"'&` using hexadecimal escapes, now that they’re not handled
            // using named character references.
            string = string.replace(regexEscape, escapeBmpSymbol);
        }
        return (string
            // Encode astral symbols.
            .replace(regexAstralSymbols, function ($0) {
            // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
            var high = $0.charCodeAt(0);
            var low = $0.charCodeAt(1);
            var codePoint = (high - 0xd800) * 0x400 + low - 0xdc00 + 0x10000;
            return escapeCodePoint(codePoint);
        })
            // Encode any remaining BMP symbols that are not printable ASCII symbols
            // using a hexadecimal escape.
            .replace(regexBmpWhitelist, escapeBmpSymbol));
    }
    exports.encode = encode;
    const defaultDecodeOptions = {
        isAttributeValue: false,
        strict: false
    };
    function decode(html, options = defaultDecodeOptions) {
        options = { ...defaultDecodeOptions, ...options };
        var strict = options.strict;
        if (strict && regexInvalidEntity.test(html)) {
            parseError("malformed character reference");
        }
        return html.replace(regexDecode, function ($0, $1, $2, $3, $4, $5, $6, $7, $8) {
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
                        parseError("`&` did not start a character reference");
                    }
                    return $0;
                }
                else {
                    if (strict) {
                        parseError("named character reference was not terminated by a semicolon");
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
                    parseError("character reference was not terminated by a semicolon");
                }
                codePoint = parseInt(decDigits, 10);
                return codePointToSymbol(codePoint, strict);
            }
            if ($6) {
                // Decode hexadecimal escapes, e.g. `&#x1D306;`.
                hexDigits = $6;
                semicolon = $7;
                if (strict && !semicolon) {
                    parseError("character reference was not terminated by a semicolon");
                }
                codePoint = parseInt(hexDigits, 16);
                return codePointToSymbol(codePoint, strict);
            }
            // If we’re still here, `if ($7)` is implied; it’s an ambiguous
            // ampersand for sure. https://mths.be/notes/ambiguous-ampersands
            if (strict) {
                parseError("named character reference was not terminated by a semicolon");
            }
            return $0;
        });
    }
    exports.decode = decode;
    function escape(string) {
        return string.replace(regexEscape, function ($0) {
            // Note: there is no need to check `has(escapeMap, $0)` here.
            return escapeMap[$0];
        });
    }
    exports.escape = escape;
    /*--------------------------------------------------------------------------*/
    const he = {
        encode,
        decode,
        escape,
        unescape: decode
    };
    exports.default = he;
});

instantiate(["file:///home/sdorries/repos/github/he/src/he"]);
