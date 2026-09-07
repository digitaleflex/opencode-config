// src/core/unicode-normalize.ts — Unified Unicode normalization, strip, and homoglyph detection

/** Strip invisible Unicode characters that can bypass detection. */
function stripInvisibleChars(str: string): string {
  // Zero-width space, zero-width non-joiner, zero-width joiner,
  // zero-width no-break space, word joiner, function application, etc.
  return str.replace(/[\u200B-\u200F\uFEFF\u034F\u180E\u2060\uFE00-\uFE0F]/g, "");
}

/** Transliterate confusable Unicode to ASCII equivalents. */
function transliterateToAscii(str: string): string {
  // Common confusables: Cyrillic → Latin, Greek → Latin

    // Cyrillic that looks like Latin (including uppercase)
  // guard-overrides.ts uses \u0440→"r" to match rm -rf patterns
  const cyrillicLower: Record<string, string> = {
    "\u0430": "a",
    "\u0435": "e",
    "\u043E": "o",
    "\u0440": "r",
    "\u0441": "c",
    "\u0443": "y", // Cyrillic у
    "\u0445": "x", // Cyrillic х
    "\u0432": "b", // Cyrillic в
    "\u043C": "m", // Cyrillic м
    "\u043D": "h", // Cyrillic н
    "\u0442": "t", // Cyrillic т
    "\u0433": "r", // Cyrillic г
    "\u0438": "u", // Cyrillic и
    "\u043A": "k", // Cyrillic к
    "\u043B": "l", // Cyrillic л
    "\u0434": "d", // Cyrillic д
    "\u0436": "w", // Cyrillic ж
    "\u0437": "z", // Cyrillic з
    "\u0444": "f", // Cyrillic ф
    "\u0448": "W", // Cyrillic ш
    "\u0449": "w", // Cyrillic щ
    "\u044A": "b", // Cyrillic ъ
    "\u044B": "b", // Cyrillic ы
    "\u044C": "b", // Cyrillic ь
    "\u044D": "e", // Cyrillic э
    "\u044E": "o", // Cyrillic ю
    "\u044F": "q", // Cyrillic я
  };

  // Cyrillic that looks like Latin (uppercase)
  const cyrillicUpper: Record<string, string> = {
    "\u0410": "A", // Cyrillic А
    "\u0415": "E", // Cyrillic Е
    "\u041E": "O", // Cyrillic О
    "\u041F": "P", // Cyrillic Р
    "\u0421": "C", // Cyrillic С
    "\u0423": "Y", // Cyrillic У
    "\u0425": "X", // Cyrillic Х
    "\u0412": "B", // Cyrillic В
    "\u041C": "M", // Cyrillic М
    "\u041D": "H", // Cyrillic Н
    "\u0422": "T", // Cyrillic Т
    "\u0413": "R", // Cyrillic Г
    "\u0418": "U", // Cyrillic И
    "\u041A": "K", // Cyrillic К
    "\u041B": "L", // Cyrillic Л
    "\u0414": "D", // Cyrillic Д
    "\u0416": "W", // Cyrillic Ж
    "\u0417": "Z", // Cyrillic З
    "\u041F": "P", // Cyrillic Ф (duplicate with 041F but kept for clarity)
    "\u0428": "W", // Cyrillic Ш (duplicate with 0448 but kept for clarity)
    "\u0429": "W", // Cyrillic Щ (duplicate with 0449 but kept for clarity)
    "\u042A": "B", // Cyrillic Ъ
    "\u042B": "B", // Cyrillic Ы
    "\u042C": "B", // Cyrillic Ь
    "\u042D": "E", // Cyrillic Э
    "\u042E": "O", // Cyrillic Ю
    "\u042F": "Q", // Cyrillic Я
  };

  // Greek that looks like Latin (including uppercase)
  const greek: Record<string, string> = {
    "\u0391": "A", // Α
    "\u0392": "B", // Β
    "\u0395": "E", // Ε
    "\u0397": "H", // Η
    "\u0399": "I", // Ι
    "\u039A": "K", // Κ
    "\u039C": "M", // Μ
    "\u039D": "N", // Ν
    "\u039F": "O", // Ο
    "\u03A1": "P", // Ρ
    "\u03A4": "T", // Τ
    "\u03A5": "Y", // Υ
    "\u0396": "Z", // Ζ
    "\u0393": "r", // Γ
    "\u0394": "d", // Δ
    "\u039B": "A", // Λ
    "\u039E": "E", // Ξ
    "\u03A0": "n", // Π
    "\u03A3": "E", // Σ
    "\u03A7": "X", // Χ
    "\u03A8": "Y", // Ψ
    "\u03A9": "O", // Ω
    "\u03B1": "a", // α
    "\u03B2": "B", // β
    "\u03B5": "e", // ε
    "\u03B7": "n", // η
    "\u03B9": "i", // ι
    "\u03BA": "k", // κ
    "\u03BC": "u", // μ
    "\u03BD": "v", // ν
    "\u03BF": "o", // ο
    "\u03C1": "p", // ρ
    "\u03C4": "t", // τ
    "\u03C5": "u", // υ
    "\u03C7": "x", // χ
    "\u03B3": "r", // γ
    "\u03B4": "d", // δ
    "\u03BB": "A", // λ
    "\u03BE": "E", // ξ
    "\u03C0": "n", // π
    "\u03C3": "o", // σ
    "\u03C6": "p", // φ
    "\u03C8": "Y", // ψ
    "\u03C9": "w", // ω
    "\u03D5": "p", // ϕ (Greek phi symbol)
    "\u03D6": "n", // ϖ (Greek pi symbol)
  };

  // Fullwidth Latin (including uppercase)
  const fullwidth: Record<string, string> = {
    // Uppercase
    "\uFF21": "A", "\uFF22": "B", "\uFF23": "C", "\uFF24": "D", "\uFF25": "E",
    "\uFF26": "F", "\uFF27": "G", "\uFF28": "H", "\uFF29": "I", "\uFF2A": "J",
    "\uFF2B": "K", "\uFF2C": "L", "\uFF2D": "M", "\uFF2E": "N", "\uFF2F": "O",
    "\uFF30": "P", "\uFF31": "Q", "\uFF32": "R", "\uFF33": "S", "\uFF34": "T",
    "\uFF35": "U", "\uFF36": "V", "\uFF37": "W", "\uFF38": "X", "\uFF39": "Y",
    "\uFF3A": "Z",
    // Lowercase
    "\uFF41": "a", "\uFF42": "b", "\uFF43": "c", "\uFF44": "d", "\uFF45": "e",
    "\uFF46": "f", "\uFF47": "g", "\uFF48": "h", "\uFF49": "i", "\uFF4A": "j",
    "\uFF4B": "k", "\uFF4C": "l", "\uFF4D": "m", "\uFF4E": "n", "\uFF4F": "o",
    "\uFF50": "p", "\uFF51": "q", "\uFF52": "r", "\uFF53": "s", "\uFF54": "t",
    "\uFF55": "u", "\uFF56": "v", "\uFF57": "w", "\uFF58": "x", "\uFF59": "y",
    "\uFF5A": "z",
  };

  // Various invisible/formatting characters
  const invisible: Record<string, string> = {
    "\u061C": "", // Arabic letter mark
    "\u200E": "", // Left-to-right mark
    "\u200F": "", // Right-to-left mark
    "\u2028": " ", // Line separator
    "\u2029": " ", // Paragraph separator
    "\u202A": "", // Left-to-right embedding
    "\u202B": "", // Right-to-left embedding
    "\u202C": "", // Pop directional formatting
    "\u202D": "", // Left-to-right override
    "\u202E": "", // Right-to-left override
    "\u2060": "", // Word joiner
    "\u2061": "", // Function application
    "\u2062": "", // Invisible times
    "\u2063": "", // Invisible separator
    "\u2064": "", // Invisible plus
    "\u2066": "", // Left-to-right isolate
    "\u2067": "", // Right-to-left isolate
    "\u2068": "", // First strong isolate
    "\u2069": "", // Pop directional isolate
    "\u180E": "", // Mongolian vowel separator → nothing
  };

  let result = str;

  // Apply all transformations
  for (const [from, to] of Object.entries({ ...cyrillicLower, ...cyrillicUpper, ...greek, ...fullwidth })) {
    result = result.split(from).join(to);
  }

  // Strip invisible characters
  result = result.replace(/[\u200B-\u200F\uFEFF\u034F\u180E\u2060]/g, "");

  // Remove other invisible characters
  for (const [from, to] of Object.entries(invisible)) {
    if (to === "") {
      result = result.replace(new RegExp(from, "g"), "");
    } else {
      result = result.replace(new RegExp(from, "g"), to);
    }
  }

  return result;
}

/** Normalizes text for matching (NFC + strip + transliterate) */
function normalizeForMatching(text: string): string {
  const normalized = text.normalize("NFC");
  const stripped = stripInvisibleChars(normalized);
  return transliterateToAscii(stripped);
}

export { stripInvisibleChars, transliterateToAscii, normalizeForMatching };