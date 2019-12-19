import { jsesc } from "../deps.ts";

import invalidRawCodePoints from '../data/invalid-raw-code-points.json';

const string = String.fromCodePoint.apply(String, invalidRawCodePoints);

export const invalidCodePointsString = jsesc(string, { 'wrap': true });
