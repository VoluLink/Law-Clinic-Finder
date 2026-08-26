/**
 * Invisible characters are stripped at two boundaries with two different
 * policies, because the scripts involved differ.
 *
 * Directory text on its way into the model context is German prose, so every
 * zero-width character in it is noise at best. Assistant text on its way to the
 * visitor may be Farsi, Arabic or Kurdish, where some of those same characters
 * are required for the text to render at all.
 */

/**
 * C0/C1 controls except tab, newline and carriage return, plus the invisible
 * operators, the deprecated formatting characters and the byte-order mark.
 * None of these carries meaning in any script this site renders.
 */
const CONTROL_CHARACTERS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2060-\u2064\u206A-\u206F\uFEFF]/g;

/**
 * Explicit bidirectional embeddings, overrides and isolates. They reorder how
 * text is displayed independently of the order it is stored in, so a reply can
 * be made to read differently from what it actually says.
 *
 * LRM/RLM and the zero-width joiners are deliberately absent here: U+200C and
 * U+200D are needed for Farsi, Arabic and Kurdish to render, and U+200E/U+200F
 * are the normal way to fix the direction of a neutral character in mixed text.
 */
const BIDI_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/g;

/** Zero-width characters, dropped only where the text is known to be German. */
const ZERO_WIDTH = /[\u200B-\u200F]/g;

/** For text rendered to the visitor in any of the nine supported languages. */
export function stripInvisible(value: string): string {
  return value.replace(CONTROL_CHARACTERS, '').replace(BIDI_CONTROLS, '');
}

/** For German directory prose on its way into the model context. */
export function stripInvisibleAndZeroWidth(value: string): string {
  return stripInvisible(value).replace(ZERO_WIDTH, '');
}
