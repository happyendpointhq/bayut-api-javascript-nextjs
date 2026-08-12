import { NextResponse } from 'next/server';

import { BayutError, locationPath, searchProperties, text, type SearchParams } from '@/lib/bayut';

/**
 * GET /api/properties?locationId=5003&purpose=for-sale&rooms=1&priceMax=1500000
 *
 * Proxies property search and flattens the response into something a client
 * component can render without knowing the API's quirks.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const numeric = (key: string) => {
    const raw = params.get(key);
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };

  const purpose = params.get('purpose');
  const search: SearchParams = {
    purpose: purpose === 'for-rent' ? 'for-rent' : 'for-sale',
    locationId: params.get('locationId') ?? undefined,
    propertyType: params.get('propertyType') ?? undefined,
    rooms: params.get('rooms') ?? undefined,
    priceMin: numeric('priceMin'),
    priceMax: numeric('priceMax'),
    page: numeric('page') ?? 1,
  };

  if (!search.locationId) {
    return NextResponse.json(
      { error: 'locationId is required. Get one from /api/locations' },
      { status: 400 }
    );
  }

  try {
    const result = await searchProperties(search);

    return NextResponse.json({
      total: result.total,
      totalPages: result.totalPages,
      page: search.page,
      properties: result.properties.map((property) => ({
        id: property.externalID,
        title: text(property.title),
        price: property.price,
        rooms: property.rooms,
        baths: property.baths,
        areaSqm: property.area ? Math.round(property.area) : null,
        purpose: property.purpose,
        verified: property.isVerified ?? false,
        completionStatus: property.completionStatus,
        location: locationPath(property),
        image: property.coverPhoto?.url ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof BayutError) {
      return NextResponse.json({ error: error.message }, { status: error.status ?? 502 });
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
