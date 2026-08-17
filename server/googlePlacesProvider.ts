import { makeRequest, type GeocodingResult, type PlaceDetailsResult, type PlacesSearchResult } from "./_core/map";

export type SearchPlan = {
  country: string;
  city: string;
  district?: string | null;
  referenceAddress?: string | null;
  category: string;
  keywords?: string[] | null;
  radiusMeters: number;
  maxResults: number;
};

export type ProviderBusiness = {
  externalId: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
  businessStatus?: string;
  categories: string[];
  phone?: string;
  website?: string;
  openingHours?: string[];
  googleMapsUrl: string;
  sourcePayload: Record<string, unknown>;
};

function locationLabel(plan: SearchPlan) {
  return [plan.referenceAddress, plan.district, plan.city, plan.country].filter(Boolean).join(", ");
}

export function buildProviderQuery(plan: SearchPlan) {
  return [plan.category, ...(plan.keywords ?? []), plan.district, plan.city, plan.country].filter(Boolean).join(" ");
}

/** Consulta únicamente los endpoints documentados de Google Places mediante el proxy autorizado. */
export async function findGoogleBusinesses(plan: SearchPlan): Promise<{ businesses: ProviderBusiness[]; operations: number }> {
  const query = buildProviderQuery(plan);
  const reference = locationLabel(plan);
  const geocoding = await makeRequest<GeocodingResult>("/maps/api/geocode/json", { address: reference });
  const location = geocoding.results[0]?.geometry.location;
  if (!location) throw new Error("No fue posible localizar la zona de referencia indicada.");

  const searched = await makeRequest<PlacesSearchResult>("/maps/api/place/textsearch/json", {
    query,
    location: `${location.lat},${location.lng}`,
    radius: Math.min(Math.max(plan.radiusMeters, 100), 50000),
  });
  const candidates = searched.results.slice(0, Math.min(plan.maxResults, 20));
  const businesses: ProviderBusiness[] = [];

  for (const candidate of candidates) {
    const details = await makeRequest<PlaceDetailsResult>("/maps/api/place/details/json", {
      place_id: candidate.place_id,
      fields: "place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,opening_hours,geometry",
    });
    const value = details.result;
    businesses.push({
      externalId: candidate.place_id,
      name: value?.name ?? candidate.name,
      address: value?.formatted_address ?? candidate.formatted_address,
      latitude: value?.geometry?.location?.lat ?? candidate.geometry.location.lat,
      longitude: value?.geometry?.location?.lng ?? candidate.geometry.location.lng,
      rating: value?.rating ?? candidate.rating,
      reviewCount: value?.user_ratings_total ?? candidate.user_ratings_total,
      businessStatus: candidate.business_status,
      categories: candidate.types ?? [],
      phone: value?.international_phone_number ?? value?.formatted_phone_number,
      website: value?.website,
      openingHours: value?.opening_hours?.weekday_text,
      googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${candidate.place_id}`,
      sourcePayload: { search: candidate, details: value ?? null },
    });
  }
  return { businesses, operations: 2 + candidates.length };
}
