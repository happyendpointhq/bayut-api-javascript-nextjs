/**
 * Bayut Property Data API client.
 *
 * Server-side only. The RapidAPI key must never reach the browser, so call this
 * from route handlers, server components, or server actions, not from client
 * components.
 */

const HOST = 'uae-real-estate3.p.rapidapi.com';
const BASE_URL = `https://${HOST}`;

// /property-details is far slower than the search endpoints, routinely over 30
// seconds, so it gets its own budget.
const DEFAULT_TIMEOUT_MS = 20_000;
const SLOW_TIMEOUT_MS = 60_000;
const SLOW_PATHS = new Set(['/property-details']);

export class BayutError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'BayutError';
    this.status = status;
  }
}

/** Localised strings arrive as {en: "..."} from search but as plain strings from details. */
export type Localised = string | Record<string, string> | null | undefined;

export interface Property {
  externalID: string;
  title: Localised;
  price: number;
  rooms?: number;
  baths?: number;
  area?: number;
  purpose?: string;
  completionStatus?: string;
  furnishingStatus?: string;
  isVerified?: boolean;
  referenceNumber?: string;
  coverPhoto?: { url?: string };
  location?: Array<{ level?: number; name?: string; externalID?: string }>;
}

export interface SearchResult {
  properties: Property[];
  total: number;
  totalPages: number;
}

export interface Location {
  externalID: string;
  name: Localised;
  adCount?: number;
}

export interface SearchParams {
  purpose?: 'for-sale' | 'for-rent';
  locationId?: string;
  propertyType?: string;
  rooms?: string | number;
  priceMin?: number;
  priceMax?: number;
  page?: number;
  sortOrder?: string;
}

/**
 * Read a localised field in either shape.
 *
 * /search-property returns {title: {en: "..."}}, /property-details returns
 * {title: "..."}. Handle both so callers do not have to know which endpoint
 * produced the record.
 */
export function text(value: Localised, lang = 'en'): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[lang] ?? Object.values(value)[0] ?? '';
}

/** Render the location hierarchy (country, city, community, building) as a path. */
export function locationPath(property: Property, separator = ' > '): string {
  return (property.location ?? [])
    .slice()
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
    .map((entry) => entry.name)
    .filter(Boolean)
    .join(separator);
}

function apiKey(): string {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) {
    throw new BayutError(
      'RAPIDAPI_KEY is not set. Add it to .env.local. Get a key at ' +
        'https://rapidapi.com/happyendpoint/api/uae-real-estate3/'
    );
  }
  return key;
}

async function request<T>(
  path: string,
  params: Record<string, unknown> = {},
  { retries = 3 }: { retries?: number } = {}
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const timeout = SLOW_PATHS.has(path) ? SLOW_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, {
        headers: { 'x-rapidapi-host': HOST, 'x-rapidapi-key': apiKey() },
        signal: controller.signal,
        // Listings move constantly, so do not let Next cache them indefinitely.
        next: { revalidate: 300 },
      });

      if (res.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
        continue;
      }
      if (res.status === 401) {
        throw new BayutError('401 Unauthorized. Check RAPIDAPI_KEY and your subscription.', 401);
      }
      if (res.status === 403) {
        throw new BayutError(
          '403 Forbidden. Your RapidAPI plan may not cover this endpoint, or the quota is used up.',
          403
        );
      }
      if (!res.ok) {
        throw new BayutError(`Bayut API returned ${res.status} for ${path}`, res.status);
      }

      const body = await res.json();
      return body.data as T;
    } catch (error) {
      if (error instanceof BayutError) throw error;
      if (attempt === retries - 1) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new BayutError(`Request to ${path} failed: ${reason}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
    } finally {
      clearTimeout(timer);
    }
  }

  throw new BayutError(`Rate limited after ${retries} attempts on ${path}`);
}

export async function autocomplete(query: string): Promise<Location[]> {
  const data = await request<{ locations: Location[] }>('/autocomplete', {
    query,
    langs: 'en',
  });
  return data.locations ?? [];
}

export async function searchProperties(params: SearchParams = {}): Promise<SearchResult> {
  const {
    purpose = 'for-sale',
    locationId,
    propertyType,
    rooms,
    priceMin,
    priceMax,
    page = 1,
    sortOrder = 'popular',
  } = params;

  const data = await request<SearchResult>('/search-property', {
    purpose,
    location_ids: locationId,
    property_type: propertyType,
    rooms,
    price_min: priceMin,
    price_max: priceMax,
    page,
    sort_order: sortOrder,
    langs: 'en',
  });

  return {
    properties: data.properties ?? [],
    total: data.total ?? 0,
    totalPages: data.totalPages ?? 1,
  };
}

export async function propertyDetails(externalId: string): Promise<Property> {
  return request<Property>('/property-details', { external_id: externalId, langs: 'en' });
}

export async function searchNewProjects(params: SearchParams = {}): Promise<SearchResult> {
  const data = await request<SearchResult>('/search-new-projects', {
    location_ids: params.locationId,
    property_type: 'residential',
    price_max: params.priceMax,
    page: params.page ?? 1,
    sort_order: 'latest',
  });

  return {
    properties: data.properties ?? [],
    total: data.total ?? 0,
    totalPages: data.totalPages ?? 1,
  };
}

/** Verified against /autocomplete. Confirm any you add, wrong IDs fail silently. */
export const LOCATIONS = {
  dubai: '5002',
  abuDhabi: '6020',
  jvc: '5416',
  businessBay: '5093',
  downtownDubai: '6901',
  dubaiMarina: '5003',
  dubaiHillsEstate: '8288',
  jlt: '5152',
  palmJumeirah: '5460',
} as const;
