export interface EntityCollection {
  [index: string]: Entity;
}

export interface Entity {
  codepoints: number[];
  characters: string;
}

export interface EncodeOptions {
  allowUnsafeSymbols?: boolean;
  encodeEverything?: boolean;
  strict?: boolean;
  useNamedReferences?: boolean;
  decimal?: boolean;
}

export interface DecodeOptions {
  isAttributeValue?: boolean;
  strict?: boolean;
}

export class OutOfRangeError extends Error {

}

export class ParseError extends Error {

}

export class ForbiddenCharacterError extends Error {}
export class MalformedDataError extends Error {}

