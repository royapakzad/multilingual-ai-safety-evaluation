
import { ExtractedEntities } from '../types';

/**
 * Language codes (as used in constants/languages.ts AVAILABLE_NATIVE_LANGUAGES) whose
 * scripts don't reliably use whitespace to separate words. A whitespace-based word count
 * is meaningless for these — an entire paragraph can come back as "1 word" since there's
 * often nothing to split on — so length is measured in characters instead, which is the
 * standard fallback for these scripts.
 */
export const NO_WHITESPACE_WORD_SEGMENTATION_LANGS = ['zh-CN', 'zh-TW', 'ja', 'th', 'km', 'lo', 'my'];

export type TextCountUnit = 'words' | 'characters';

/** The unit a language's text length is actually measured in — see countTextUnits. */
export const getCountUnitForLanguage = (langCode: string): TextCountUnit =>
  NO_WHITESPACE_WORD_SEGMENTATION_LANGS.includes(langCode) ? 'characters' : 'words';

/**
 * Counts a text's length in whichever unit is meaningful for its language: whitespace-split
 * words for space-delimited scripts, non-whitespace character count for scripts that don't
 * use spaces between words (NO_WHITESPACE_WORD_SEGMENTATION_LANGS). Callers must display the
 * returned `unit`, not assume it's always "words" — silently labeling a character count as a
 * word count would misrepresent response length for the affected languages.
 */
export const countTextUnits = (text: string | null, langCode: string): { count: number; unit: TextCountUnit } => {
  const unit = getCountUnitForLanguage(langCode);
  if (!text || !text.trim()) return { count: 0, unit };
  if (unit === 'characters') {
    // Array.from (not .length) to count Unicode code points correctly, not UTF-16 code units.
    return { count: Array.from(text.replace(/\s+/g, '')).length, unit };
  }
  return { count: text.trim().split(/\s+/).filter(Boolean).length, unit };
};

// Helper function to convert Eastern Arabic numerals (used in Persian, Urdu, etc.)
// to Western Arabic numerals (0-9) for consistent processing.
const normalizeDigits = (text: string): string => {
  const easternArabicNumerals: { [key: string]: string } = {
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
  };
  return text.replace(/[۰-۹]/g, (char) => easternArabicNumerals[char]);
};


// Regex for URLs (improved to be more inclusive of domains without http/www prefixes)
const URL_REGEX = /\b((?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]|\((?:[^\s()<>]|(?:\([^\s()<>]+\)))*\))+(?:\((?:[^\s()<>]|(?:\([^\s()<>]+\)))*\)|[^\s`!()[\]{};:'".,<>?«»“”‘’]))/gi;

// Regex for Email Addresses (common pattern)
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;

// Regex for Phone Numbers (more comprehensive, tries to catch various international formats). Post-processing is used to ensure at least 7 digits.
// Runs on text with normalized digits.
const PHONE_REGEX = /(?:\+?\d{1,4}[\s.-]?)?(?:\(\d{1,5}\)[\s.-]?)?[\d\s.-]{7,}\d/g;

/**
 * A dictionary of humanitarian organizations and their common names/acronyms across different languages.
 * This is used for automatic entity recognition.
 */
const orgDictionary = [
    { acronym: 'UNHCR', names: { en: ['United Nations High Commissioner for Refugees', 'UN Refugee Agency'], fa: ['کمیساریای عالی سازمان ملل برای پناهندگان', 'آژانس پناهندگان سازمان ملل'] } },
    { acronym: 'MSF', names: { en: ["Doctors Without Borders"], fr: ["Médecins Sans Frontières"], fa: ["پزشکان بدون مرز"] } },
    { acronym: 'IOM', names: { en: ["International Organization for Migration"], fa: ["سازمان بین المللی مهاجرت"] } },
    { acronym: 'ICRC', names: { en: ["International Committee of the Red Cross"], fa: ["کمیته بین المللی صلیب سرخ"] } },
    { acronym: 'WFP', names: { en: ["World Food Programme"], fa: ["برنامه جهانی غذا"] } },
    { acronym: 'UNICEF', names: { en: ["United Nations Children's Fund"], fa: ["صندوق کودکان سازمان ملل متحد"] } },
];

/**
 * Extracts known organizations and general acronyms from text.
 * @param text The source text to analyze.
 * @param langCode The BCP-47 language code of the text (e.g., 'en', 'fa').
 * @returns An array of unique potential organization/acronym strings.
 */
const extractOrganizationsAndAcronyms = (text: string, langCode: string = 'en'): string[] => {
    const lang = langCode.split('-')[0]; // Use base language code (e.g., 'en' from 'en-US')
    const foundEntities = new Set<string>();

    // 1. Find entities from the dictionary
    orgDictionary.forEach(org => {
        // Regex for the acronym, allowing for dots (e.g., U.N.H.C.R.)
        const acronymRegex = new RegExp(`\\b${org.acronym.split('').join('\\.?')}\\b`, 'gi');
        const acronymMatches = text.match(acronymRegex);
        if (acronymMatches) {
            acronymMatches.forEach(match => foundEntities.add(match));
        }

        // Regex for full names in the specified language, optionally followed by the acronym in parentheses
        const namesInLang = org.names[lang as keyof typeof org.names];
        if (namesInLang) {
            namesInLang.forEach(name => {
                // Escape special regex characters in the name, if any.
                const escapedName = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const nameRegex = new RegExp(`\\b${escapedName}(?:\\s*\\(\\s*${org.acronym}\\s*\\))?\\b`, 'gi');
                const nameMatches = text.match(nameRegex);
                if (nameMatches) {
                    nameMatches.forEach(match => foundEntities.add(match.trim()));
                }
            });
        }
    });

    // 2. Find generic capitalized acronyms (3+ letters) that are not already found.
    const genericAcronymRegex = /\b([A-Z][A-Z0-9]{2,})\b/g;
    const genericMatches = text.match(genericAcronymRegex);
    if (genericMatches) {
        genericMatches.forEach(match => {
            if (![...foundEntities].some(found => found.includes(match))) {
                foundEntities.add(match);
            }
        });
    }
    
    return Array.from(foundEntities);
};


/**
 * Extracts potential physical addresses from text using heuristic-based regexes for both
 * English and Farsi/Dari address patterns. These are designed to be non-greedy by stopping at line breaks.
 * @param text The source text to analyze (should not be digit-normalized for Farsi patterns).
 * @returns An array of unique potential address strings.
 */
const extractPhysicalAddresses = (text: string): string[] => {
    // Pattern for typical English-style addresses (number first) and P.O. boxes.
    const englishAddressRegex = /\b(\d{1,5}\s+([A-Za-z0-9\s.,'#-]+?)\b(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl|Circle|Cir)|P\.?O\.?\s+Box\s+\d+)\b/gi;
    
    // Pattern for Farsi/Dari-style addresses.
    // This heuristic matches keywords and the text that follows,
    // stopping at a newline or period to avoid capturing an entire sentence.
    const farsiAddressRegex = /(?:آدرس|خیابان|کوچه|بلوار|میدان|پلاک)\s*[:\s]*[^\n\.]+/g;

    const englishMatches = text.match(englishAddressRegex) || [];
    const farsiMatches = text.match(farsiAddressRegex) || [];
    
    const allMatches = [...englishMatches, ...farsiMatches];

    if (allMatches.length === 0) {
        return [];
    }
    // Use a Set to get unique addresses and clean them up
    return [...new Set(allMatches.map(m => m.trim().replace(/,$/, '')))];
};


export const analyzeTextResponse = (text: string, langCode: string = 'en'): ExtractedEntities => {
  if (!text || !text.trim()) {
    return {
      mentioned_links_list: [],
      mentioned_links_count: 0,
      mentioned_emails_list: [],
      mentioned_emails_count: 0,
      mentioned_phones_list: [],
      mentioned_phones_count: 0,
      physical_addresses_list: [],
      physical_addresses_count: 0,
      mentioned_references_list: [],
      mentioned_references_count: 0,
    };
  }
  
  // Normalize digits for phone number detection
  const normalizedText = normalizeDigits(text);

  const mentioned_links_list = Array.from(text.matchAll(URL_REGEX)).map(match => match[0]);
  const mentioned_emails_list = Array.from(text.matchAll(EMAIL_REGEX)).map(match => match[0]);
  
  // Use normalized text for phone numbers
  const raw_phones = Array.from(normalizedText.matchAll(PHONE_REGEX)).map(match => match[0]);
  // Post-filter phone numbers to avoid overly short/simple numbers like '2024' or '123'.
  // This check ensures we only capture legitimate-looking phone numbers by requiring at least 7 digits.
  const mentioned_phones_list = raw_phones.filter(phone => phone.replace(/\D/g, '').length >= 7);

  // Use original text for addresses to preserve Farsi characters and context
  const physical_addresses_list = extractPhysicalAddresses(text);

  // Use original text for organization/acronym detection, passing the language code
  const mentioned_references_list = extractOrganizationsAndAcronyms(text, langCode);
  
  return {
    mentioned_links_list,
    mentioned_links_count: mentioned_links_list.length,
    mentioned_emails_list,
    mentioned_emails_count: mentioned_emails_list.length,
    mentioned_phones_list,
    mentioned_phones_count: mentioned_phones_list.length,
    physical_addresses_list,
    physical_addresses_count: physical_addresses_list.length,
    mentioned_references_list,
    mentioned_references_count: mentioned_references_list.length,
  };
};
