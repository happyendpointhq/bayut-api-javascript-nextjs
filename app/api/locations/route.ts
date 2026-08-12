import { NextResponse } from 'next/server';

import { autocomplete, BayutError, text } from '@/lib/bayut';

/**
 * GET /api/locations?query=dubai+marina
 *
 * Proxies location autocomplete. Exists so the browser never sees the API key.
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('query');

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ error: 'query must be at least 2 characters' }, { status: 400 });
  }

  try {
    const locations = await autocomplete(query);

    return NextResponse.json({
      locations: locations.map((location) => ({
        id: location.externalID,
        name: text(location.name),
        listings: location.adCount ?? 0,
      })),
    });
  } catch (error) {
    if (error instanceof BayutError) {
      return NextResponse.json({ error: error.message }, { status: error.status ?? 502 });
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
