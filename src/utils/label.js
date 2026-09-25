const PICTOGRAPHS = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}\u{2600}-\u{27BF}\u{FE0E}\u{FE0F}\u{200D}]/gu;

// Data labels ship with emoji; the codec interface renders them as monospace text
export function cleanLabel(label) {
  return String(label).replace(PICTOGRAPHS, '').replace(/\s+/g, ' ').trim();
}
