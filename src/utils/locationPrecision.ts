import type { LocationCandidate, PropertyInput } from "../types";
import { cleanAdministrativeAddress, isAdministrativeOnlyAddress } from "./addressNormalize";
import { cleanCommunityDisplayName } from "./community";

const specificTargetPattern =
  /(路|街|大道|巷|弄|號|段|社區|花園|大廈|名邸|新城|山莊|公寓|華廈|苑|園|地標|選點|地圖點|座標)/;

export const withRegionalPrefix = (value: string | undefined, input: Pick<PropertyInput, "city" | "district">) => {
  const region = [input.city, input.district].filter(Boolean).join("");
  const cleaned = cleanAdministrativeAddress(value ?? "", input.city, input.district);
  if (!cleaned) return "";
  if (!region || cleaned.startsWith(region)) return cleaned;
  return cleanAdministrativeAddress(`${region}${cleaned}`, input.city, input.district);
};

export const isSpecificTargetText = (value: string | undefined, input: Pick<PropertyInput, "city" | "district">) => {
  const cleaned = cleanAdministrativeAddress(value ?? "", input.city, input.district);
  if (!cleaned || isAdministrativeOnlyAddress(cleaned, input.city, input.district)) return false;
  return specificTargetPattern.test(cleaned);
};

export const buildTargetLabel = (
  input: Pick<PropertyInput, "address" | "city" | "district" | "road" | "communityName">,
  selectedLocation?: LocationCandidate,
  fallback = "尚未指定標的",
) => {
  const region = [input.city, input.district].filter(Boolean).join("");
  const community = cleanCommunityDisplayName(input.communityName, input.city, input.district);
  const candidates = [
    withRegionalPrefix(input.address, input),
    withRegionalPrefix(selectedLocation?.label, input),
    withRegionalPrefix(community, input),
    withRegionalPrefix(input.road, input),
  ];
  return candidates.find((item) => isSpecificTargetText(item, input)) || region || fallback;
};

export const isApproximateFallbackLocation = (candidate?: LocationCandidate) =>
  candidate?.source === "manual" && /^(admin-fuzzy|structured-)/.test(candidate.id);

export const isExplicitMapPick = (candidate?: LocationCandidate) =>
  candidate?.source === "manual" && /^manual-/.test(candidate.id);

export const isPreciseTargetLocation = (input: PropertyInput, selectedLocation?: LocationCandidate) => {
  if (typeof input.lat !== "number" || typeof input.lng !== "number") return false;
  if (isApproximateFallbackLocation(selectedLocation)) return false;

  const confidence = selectedLocation?.confidence ?? input.locationConfidence;
  const hasSpecificLabel = [input.address, input.communityName, input.road, selectedLocation?.label].some((item) =>
    isSpecificTargetText(item, input),
  );

  if (hasSpecificLabel && confidence >= 0.72) return true;
  if ((isExplicitMapPick(selectedLocation) || selectedLocation?.id.startsWith("reverse-")) && confidence >= 0.72) {
    return true;
  }
  return false;
};
