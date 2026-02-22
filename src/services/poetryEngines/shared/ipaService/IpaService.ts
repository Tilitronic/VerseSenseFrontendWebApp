// // Define string literal types for vowel classification features
// export type VowelHeight = 'close' | 'near-close' | 'close-mid' | 'mid' | 'open-mid' | 'near-open' | 'open';
// export type VowelBackness = 'front' | 'central' | 'back';

// // Define string literal types for consonant classification features
// export type ConsonantPlace =
//     | 'BILABIAL'
//     | 'LABIODENTAL'
//     | 'LINGUOLABIAL'
//     | 'DENTAL'
//     | 'ALVEOLAR'
//     | 'POSTALVEOLAR'
//     | 'RETROFLEX'
//     | 'PALATAL'
//     | 'LABIALVELAR'
//     | 'VELAR'
//     | 'UVULAR'
//     | 'PHARYNGEAL/EPIGLOTTAL'
//     | 'GLOTTAL';

// export type ConsonantManner =
//     | 'NASAL'
//     | 'PLOSIVE'
//     | 'IMPLOSIVE'
//     | 'SIBILANT AFFRICATE'
//     | 'NON-SIBILANT AFFRICATE'
//     | 'SIBILANT FRICATIVE'
//     | 'NON-SIBILANT FRICATIVE'
//     | 'APPROXIMANT'
//     | 'TAP/FLAP'
//     | 'TRILL'
//     | 'LATERAL AFFRICATE'
//     | 'LATERAL FRICATIVE'
//     | 'LATERAL APPROXIMANT'
//     | 'LATERAL TAP/FLAP';

// // Base interface for any IPA symbol object
// export interface IPASymbol {
//     symbol: string;
//     url?: string;
// }

// // Interface for Vowel symbols
// export interface VowelSymbol extends IPASymbol {
//     height: VowelHeight;
//     backness: VowelBackness;
// }

// // Interface for Consonant symbols
// export interface ConsonantSymbol extends IPASymbol {
//     place: ConsonantPlace;
//     manner: ConsonantManner;
// }

// // The CONSONANTS and VOWELS variables are assumed to be typed arrays
// import { CONSONANTS, VOWELS } from "ipa-symbols/ipa_symbols.js";

// // Returns true if a symbol is a vowel, else false
// export const isVowel = (symbol: IPASymbol): symbol is VowelSymbol => {
//     return VOWELS.filter(s => s.symbol === symbol.symbol).length !== 0;
// };

// // Filter vowels by height
// export const getVowelsByHeight = (height: VowelHeight): VowelSymbol[] => {
//     return VOWELS.filter(s => s.height === height);
// }

// // Filter vowels by backness
// export const getVowelsByBackness = (backness: VowelBackness): VowelSymbol[] => {
//     return VOWELS.filter(s => s.backness === backness);
// }

// // Returns true if a symbol is a consonant, else false
// export const isConsonant = (symbol: IPASymbol): symbol is ConsonantSymbol => {
//     return CONSONANTS.filter(s => s.symbol === symbol.symbol).length !== 0;
// };

// // Filter consonants by place
// export const getConsonantsByPlace = (place: ConsonantPlace): ConsonantSymbol[] => {
//     return CONSONANTS.filter(s => s.place === place);
// }

// // Filter consonants by manner
// export const getConsonantsByManner = (manner: ConsonantManner): ConsonantSymbol[] => {
//     return CONSONANTS.filter(s => s.manner === manner);
// }

// // Returns a Wikipedia link for a given symbol, or the symbol itself if there is no link
// export const getSymbolLink = (symbol: IPASymbol): string => {
//     if (symbol?.url === undefined || symbol?.url === '') return `${symbol.symbol}`;
//     const name = symbol.url.split("/wiki/")[1].split("_").join(" ");
//     return "[[" + name + "| " + symbol.symbol + "]]";
// };

// // Returns a Wikipedia link for vowel backnesses
// export const getBacknessLink = (backness: VowelBackness | string): string => {
//     switch (backness) {
//         case 'front':
//             return "[[Front vowel|Front]]";
//         case 'central':
//             return "[[Central vowel|Central]]";
//         case 'back':
//             return "[[Back vowel|Back]]";
//         default:
//             // This handles any string that is not a defined VowelBackness literal
//             if (typeof backness === 'string') {
//                  return backness.charAt(0).toUpperCase() + backness.slice(1);
//             }
//             return String(backness);
//     };
// };

// // Returns a Wikipedia link for vowel heights
// export const getHeightLink = (height: VowelHeight | string): string => {
//     switch (height) {
//         case 'close':
//             return "[[Close vowel|Close]]";
//         case 'near-close':
//             return "[[Near-close vowel|Near-close]]";
//         case 'close-mid':
//             return "[[Close-mid vowel|Close-mid]]";
//         case 'mid':
//             return "[[Mid vowel|Mid]]";
//         case 'open-mid':
//             return "[[Open-mid vowel|Open-mid]]";
//         case 'near-open':
//             return "[[Near-open vowel|Near-open]]";
//         case 'open':
//             return "[[Open vowel|Open]]";
//         default:
//             return String(height);
//     };
// };

// // Returns a Wikipedia link for consonant places
// export const getPlaceLink = (place: ConsonantPlace | string): string => {
//     switch (place) {
//         case 'BILABIAL':
//             return "[[Bilabial consonant|Bilabial]]";
//         case 'LABIODENTAL':
//             return "[[Labiodental consonant|Labio-dental]]";
//         case 'LINGUOLABIAL':
//             return "[[Linguolabial consonant|Linguo-labial]]";
//         case 'DENTAL':
//             return "[[Dental consonant|Dental]]";
//         case 'ALVEOLAR':
//             return "[[Alveolar consonant|Alveolar]]";
//         case 'POSTALVEOLAR':
//             return "[[Postalveolar consonant|Post-alveolar]]";
//         case 'RETROFLEX':
//             return "[[Retroflex consonant|Retroflex]]";
//         case 'PALATAL':
//             return "[[Palatal consonant|Palatal]]";
//         case 'LABIALVELAR':
//             return "[[Labial–velar consonant|Labial–velar]]";
//         case 'VELAR':
//             return "[[Velar consonant|Velar]]";
//         case 'UVULAR':
//             return "[[Uvular consonant|Uvular]]";
//         case 'PHARYNGEAL/EPIGLOTTAL':
//             return "[[Pharyngeal consonant|Pharyngeal/Epiglottal]]";
//         case 'GLOTTAL':
//             return "[[Glottal consonant|Glottal]]";
//         default:
//             return String(place);
//     };
// };

// // Returns a Wikipedia link for consonant manners
// export const getMannerLink = (manner: ConsonantManner | string): string => {
//     switch (manner) {
//         case 'NASAL':
//             return "[[Nasal consonant|Nasal]]";
//         case 'PLOSIVE':
//             return "[[Plosive]]";
//         case 'IMPLOSIVE':
//             return "[[Implosive consonant|Implosive]]";
//         case 'SIBILANT AFFRICATE':
//             return "[[Sibilant]] [[affricate]]";
//         case 'NON-SIBILANT AFFRICATE':
//             return "Non-sibilant affricate";
//         case 'SIBILANT FRICATIVE':
//             return "Sibilant [[fricative]]";
//         case 'NON-SIBILANT FRICATIVE':
//             return "Non-sibilant fricative";
//         case 'APPROXIMANT':
//             return "[[Approximant]]";
//         case 'TAP/FLAP':
//             return "[[Tap and flap consonants|Tap/flap]]";
//         case 'TRILL':
//             return "[[Trill consonant|Trill]]";
//         case 'LATERAL AFFRICATE':
//             return "[[Lateral consonant|Lateral]] affricate";
//         case 'LATERAL FRICATIVE':
//             return "Lateral fricative";
//         case 'LATERAL APPROXIMANT':
//             return "Lateral approximant";
//         case 'LATERAL TAP/FLAP':
//             return "Lateral tap/flap";
//         default:
//             return String(manner);
//     };
// };
