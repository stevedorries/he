export { default as regenerate, Regenerate } from 'https://denopkg.com/stevedorries/regenerate/regenerate.ts';
export { jsesc } from 'https://denopkg.com/stevedorries/jsesc/mod.ts';

/**
 * 
 * @return {Array<?>} the values from array that are not present in the other arrays 
 */
export function difference(first: any[], second: any[]) {
    const arrays = [first,second];
    return arrays.reduce((a, b) => a.filter(c => !b.includes(c)));
}

/** Returns a new array with duplicate entries removed */
export function uniq(value: any[]) {
    return [...new Set(value)];
}