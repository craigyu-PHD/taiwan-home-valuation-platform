import type { LocationCandidate, TransactionCase } from "../types";
import {
  cleanAdministrativeAddress,
  isAdministrativeOnlyAddress,
  normalizeAddressText,
  stripAdministrativePrefix,
} from "./addressNormalize";
import { haversineMeters } from "./format";

const communitySuffixPattern = /(社區|花園|大廈|名邸|新城|山莊|公寓|華廈|苑|園)+$/;

export const normalizeCommunityName = (value?: string) => {
  if (!value) return "";
  return normalizeAddressText(value.normalize("NFKC"))
    .replace(/國度花園/g, "國都花園")
    .replace(communitySuffixPattern, "");
};

export const communityEquals = (a?: string, b?: string) => {
  const left = normalizeCommunityName(a);
  const right = normalizeCommunityName(b);
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
};

export const cleanCommunityDisplayName = (value?: string, city?: string, district?: string) => {
  if (!value) return undefined;
  const withoutAdminPrefix = stripAdministrativePrefix(value, city, district);
  const cleaned = cleanAdministrativeAddress(withoutAdminPrefix || value, city, district);
  if (!cleaned || isAdministrativeOnlyAddress(cleaned, city, district)) return undefined;
  return cleaned;
};

export const inferCommunityFromText = (value?: string, city?: string, district?: string) => {
  const label = value?.normalize("NFKC").trim() ?? "";
  if (!label) return undefined;
  if (/國[都度]花園/.test(label)) return "國都花園社區";
  const parenthesized = label.match(/[（(]([^）)]+(?:社區|花園|大廈|名邸|新城|山莊|公寓|華廈|苑|園)?)[）)]/);
  if (parenthesized?.[1]) {
    return cleanCommunityDisplayName(parenthesized[1], city, district);
  }
  return cleanCommunityDisplayName(
    label.match(/([\u4e00-\u9fa5A-Za-z0-9]{2,}(?:社區|花園|大廈|名邸|新城|山莊|公寓|華廈|苑|園))/)?.[1],
    city,
    district,
  );
};

export const inferCommunityFromCandidate = (candidate: LocationCandidate) =>
  inferCommunityFromText(candidate.label, candidate.city, candidate.district);

export const inferCommunityFromNearbyTransactions = (
  candidate: Pick<LocationCandidate, "city" | "district" | "road" | "lat" | "lng">,
  transactions: TransactionCase[],
  radiusMeters = 180,
) => {
  const nearest = transactions
    .filter((item) => {
      if (!item.communityName) return false;
      if (candidate.city && item.city !== candidate.city) return false;
      if (candidate.district && item.district !== candidate.district) return false;
      if (candidate.road && item.road !== candidate.road) return false;
      return haversineMeters(candidate.lat, candidate.lng, item.lat, item.lng) <= radiusMeters;
    })
    .sort((a, b) => haversineMeters(candidate.lat, candidate.lng, a.lat, a.lng) - haversineMeters(candidate.lat, candidate.lng, b.lat, b.lng))[0];
  return nearest?.communityName;
};
