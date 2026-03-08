export const normalizeText = (text: string): string => {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
};
