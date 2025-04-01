// Utility functions for string operations

const WHITE_SPACE = ' '
const FILLER = '...'

/**
 * Pads a given string with spaces evenly on both sides to reach a specified total length.
 * If the total padding length is odd, the extra space is added to the right side.
 * If the input string is longer than the specified length, it truncates the string
 * and appends an ellipsis (`...`) to fit within the specified length.
 *
 * @param text - The string to pad.
 * @param padLength - The total length of the resulting padded string.
 * @returns The padded string with spaces added around the original text, or a truncated string with an ellipsis.
 */
export const padAround = (text: string, padLength: number): string => {
  if (text.length > padLength) {
    return text.substring(0, text.length - FILLER.length) + FILLER
  }

  const paddingLength = padLength / 2 - text.length

  if (paddingLength < 0) {
    return text
  }

  const leftPaddingLength = Math.floor(paddingLength)
  const leftPadding = WHITE_SPACE.repeat(leftPaddingLength)

  const rightPaddingLength = Math.ceil(paddingLength)
  const rightPadding = WHITE_SPACE.repeat(rightPaddingLength)

  return `${leftPadding}${text}${rightPadding}`
}

/**
 * Replaces the content of a string with another string, padding it with spaces if necessary.
 * If the replacement string is longer than the original string, it truncates the replacement
 * and appends an ellipsis (`...`) to fit within the original string's length.
 * If the replacement string is shorter, it centers the replacement text within the original string's length.
 *
 * @param text - The original string to replace.
 * @param replaceText - The string to replace the original content with. Defaults to an empty string.
 * @returns The resulting string with the replacement text and appropriate padding or truncation.
 */
export const padReplace = (text: string, replaceText = ''): string => {
  if (replaceText.length > text.length) {
    return replaceText.substring(0, text.length - FILLER.length) + FILLER
  }

  const paddingLength = text.length / 2 - replaceText.length / 2

  const leftPaddingLength = Math.floor(paddingLength) // Floor used to favor left side if odd number of characters"
  const leftPadding = WHITE_SPACE.repeat(leftPaddingLength)

  const rightPaddingLength = Math.ceil(paddingLength)
  const rightPadding = WHITE_SPACE.repeat(rightPaddingLength)

  return `${leftPadding}${replaceText}${rightPadding}`
}
