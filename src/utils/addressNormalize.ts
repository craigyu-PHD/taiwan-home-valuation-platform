const digitMap: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  兩: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

const fullWidthToHalfWidth = (value: string) =>
  value.replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0)).replace(/　/g, " ");

const parseChineseInteger = (value: string) => {
  if (!value) return NaN;
  if (value === "十") return 10;
  let total = 0;
  let current = 0;
  for (const char of value) {
    if (char === "百") {
      total += (current || 1) * 100;
      current = 0;
    } else if (char === "十") {
      total += (current || 1) * 10;
      current = 0;
    } else if (char in digitMap) {
      current = digitMap[char];
    }
  }
  return total + current;
};

export const normalizeAddressText = (value: string) => {
  const normalized = fullWidthToHalfWidth(value)
    .trim()
    .toLowerCase()
    .replace(/[臺]/g, "台")
    .replace(/[縣市]/g, (char) => char)
    .replace(/[，,。．.、\s-]/g, "")
    .replace(/([零〇一二兩三四五六七八九十百]+)(?=(段|巷|弄|號|樓|層|之|室|棟))/g, (match) => {
      const parsed = parseChineseInteger(match);
      return Number.isNaN(parsed) ? match : String(parsed);
    });

  return normalized;
};

export const getAddressSearchVariants = (value: string) => {
  const normalized = normalizeAddressText(value);
  const withoutAdministrativeSuffix = normalized.replace(/[台臺](北|中|南|東)市/g, "台$1市");
  return [...new Set([normalized, withoutAdministrativeSuffix])].filter(Boolean);
};
