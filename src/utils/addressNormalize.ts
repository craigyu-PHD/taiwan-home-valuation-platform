import { taiwanAdmin, taiwanCities } from "../data/taiwanAdmin";

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

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeDisplayToken = (value?: string) =>
  fullWidthToHalfWidth(value ?? "")
    .replace(/[臺]/g, "台")
    .replace(/國度花園/g, "國都花園")
    .replace(/[，,。．.、\s-]/g, "")
    .trim();

const trimAdministrativeSuffix = (value: string) => value.replace(/[縣市區鄉鎮]$/g, "");

const findAdministrativeTokens = (value: string, city?: string, district?: string) => {
  const text = normalizeDisplayToken(value);
  const cityName =
    city ??
    taiwanCities.find((item) => {
      const normalizedCity = normalizeDisplayToken(item);
      return text.includes(normalizedCity) || text.includes(trimAdministrativeSuffix(normalizedCity));
    });
  const cityToken = normalizeDisplayToken(cityName);
  const districtName =
    district ??
    (cityName
      ? taiwanAdmin[cityName as keyof typeof taiwanAdmin]?.find((item) => text.includes(normalizeDisplayToken(item)))
      : taiwanCities
          .flatMap((item) => taiwanAdmin[item as keyof typeof taiwanAdmin] ?? [])
          .find((item) => text.includes(normalizeDisplayToken(item))));
  const districtToken = normalizeDisplayToken(districtName);

  return { cityName, districtName, cityToken, districtToken };
};

export const cleanAdministrativeAddress = (value: string, city?: string, district?: string) => {
  let text = normalizeDisplayToken(value);
  if (!text) return "";

  const { cityToken, districtToken } = findAdministrativeTokens(text, city, district);
  const tokens = [cityToken, districtToken].filter(Boolean);

  for (const token of tokens) {
    text = text.replace(new RegExp(`(?:${escapeRegExp(token)}){2,}`, "g"), token);
  }

  if (cityToken && districtToken) {
    const pair = `${cityToken}${districtToken}`;
    text = text.replace(new RegExp(`(?:${escapeRegExp(pair)}){2,}`, "g"), pair);

    const cityStem = trimAdministrativeSuffix(cityToken);
    const districtStem = trimAdministrativeSuffix(districtToken);
    const adminOnlyTokens = [cityToken, districtToken, cityStem, districtStem]
      .filter((item, index, items) => item && items.indexOf(item) === index)
      .map(escapeRegExp);
    const adminOnlyPattern = new RegExp(`^(?:${adminOnlyTokens.join("|")})+$`);
    const stripLeadingAdministrativeNoise = (value: string) => {
      let next = value;
      let changed = true;
      while (changed && next) {
        changed = false;
        for (const token of [pair, cityToken, districtToken]) {
          if (token && next.startsWith(token)) {
            next = next.slice(token.length);
            changed = true;
          }
        }
        for (const stem of [cityStem, districtStem]) {
          if (!stem || !next.startsWith(stem)) continue;
          const rest = next.slice(stem.length);
          const isAdminChain =
            !rest ||
            [pair, cityToken, districtToken, cityStem, districtStem].some((token) => token && rest.startsWith(token));
          if (isAdminChain) {
            next = rest;
            changed = true;
          }
        }
      }
      return next;
    };

    if (text.startsWith(pair)) {
      const tail = text.slice(pair.length);
      const cleanedTail = stripLeadingAdministrativeNoise(tail);
      if (tail && cleanedTail !== tail) return `${pair}${cleanedTail}`;
      if (tail && adminOnlyPattern.test(tail)) return pair;
    }
    if (adminOnlyPattern.test(text)) return pair;
  }

  return text;
};

export const stripAdministrativePrefix = (value: string, city?: string, district?: string) => {
  let text = cleanAdministrativeAddress(value, city, district);
  const { cityToken, districtToken } = findAdministrativeTokens(text, city, district);
  if (cityToken && districtToken && text.startsWith(`${cityToken}${districtToken}`)) {
    text = text.slice(`${cityToken}${districtToken}`.length);
  } else if (cityToken && text.startsWith(cityToken)) {
    text = text.slice(cityToken.length);
    if (districtToken && text.startsWith(districtToken)) {
      text = text.slice(districtToken.length);
    }
  }
  return text;
};

export const isAdministrativeOnlyAddress = (value?: string, city?: string, district?: string) => {
  if (!value) return false;
  const cleaned = cleanAdministrativeAddress(value, city, district);
  const { cityToken, districtToken } = findAdministrativeTokens(cleaned, city, district);
  if (!cityToken && !districtToken) return false;
  const cityStem = cityToken ? trimAdministrativeSuffix(cityToken) : "";
  const districtStem = districtToken ? trimAdministrativeSuffix(districtToken) : "";
  const allowed = [cityToken, districtToken, cityStem, districtStem]
    .filter((item, index, items) => item && items.indexOf(item) === index)
    .map(escapeRegExp);
  return allowed.length > 0 && new RegExp(`^(?:${allowed.join("|")})+$`).test(cleaned);
};

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
    .replace(/國度花園/g, "國都花園")
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
