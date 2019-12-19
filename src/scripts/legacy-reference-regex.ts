import legacyReferences from '../data/decode-legacy-named-references.json';

export const regexLegacyReference = '&(' + legacyReferences.join('|') +
	')(?!;)([=a-zA-Z0-9]?)';
