# Bayut API Next.js Example

A working Next.js 15 App Router application built on the
[Bayut Property Data API](https://rapidapi.com/happyendpoint/api/uae-real-estate3/):
debounced location autocomplete, property search, and result cards, in
TypeScript.

Built and maintained by [Happy Endpoint](https://happyendpoint.com). Full API
reference at [bayutapi.dev](https://bayutapi.dev).

---

## What is in here

| Path | What it is |
|---|---|
| `lib/bayut.ts` | Typed API client with retries, timeouts, and error handling |
| `app/api/locations/route.ts` | Route handler proxying location autocomplete |
| `app/api/properties/route.ts` | Route handler proxying property search |
| `components/LocationSearch.tsx` | Debounced autocomplete with request cancellation |
| `components/PropertyCard.tsx` | Listing card with AED formatting and unit conversion |
| `app/page.tsx` | The search page tying it together |

This builds and runs. `npm run build` produces a clean production build, and
both route handlers return live data.

---

## Quick start

```bash
git clone https://github.com/happyendpointhq/bayut-api-javascript-nextjs
cd bayut-api-javascript-nextjs
npm install

cp .env.example .env.local
# then add your key to .env.local

npm run dev
```

Open http://localhost:3000, search for an area, and pick it from the dropdown.

Get a key, free tier available, at
https://rapidapi.com/happyendpoint/api/uae-real-estate3/

---

## Keep the key on the server

This matters more than anything else in this repo.

```
RAPIDAPI_KEY=your_key_here          # correct, server only
NEXT_PUBLIC_RAPIDAPI_KEY=...        # wrong, ships to every visitor
```

Anything prefixed `NEXT_PUBLIC_` is inlined into the client bundle and readable
by anyone who opens devtools. A leaked RapidAPI key gets used, and you pay for
the usage.

The pattern here is that `lib/bayut.ts` is only imported by route handlers, which
run on the server. Client components call `/api/properties` on your own origin,
never the Bayut API directly.

---

## Using the client

```typescript
import { searchProperties, autocomplete, text, LOCATIONS } from '@/lib/bayut';

// Resolve an area name to a location ID
const locations = await autocomplete('dubai marina');
const locationId = locations[0].externalID;

// Or use a verified constant
const results = await searchProperties({
  purpose: 'for-sale',
  locationId: LOCATIONS.dubaiMarina,
  propertyType: 'apartments',
  rooms: '1',
  priceMax: 1_500_000,
});

console.log(`${results.total} properties`);
for (const property of results.properties) {
  console.log(text(property.title), property.price);
}
```

### Server component

```tsx
import { searchProperties, text, LOCATIONS } from '@/lib/bayut';

export default async function MarinaListings() {
  const { properties } = await searchProperties({
    locationId: LOCATIONS.dubaiMarina,
    rooms: '1',
  });

  return (
    <ul>
      {properties.map((property) => (
        <li key={property.externalID}>
          {text(property.title)} - AED {property.price.toLocaleString()}
        </li>
      ))}
    </ul>
  );
}
```

---

## Response shape notes

The API is not consistent between endpoints, which is why `lib/bayut.ts` exports
helpers rather than leaving you to parse raw responses.

**`title` has two shapes.** `/search-property` returns `{title: {en: "..."}}`
while `/property-details` returns `title` as a plain string. Use `text()`, which
handles both.

**`location` is a hierarchy array**, ordered by level: country, city, community,
building. Use `locationPath()` to render it as `UAE > Dubai > Dubai Marina >
Studio One Tower`.

**`/property-details` is slow**, routinely over 30 seconds against sub-second
search responses. The client raises its timeout automatically for that path.

**Rental prices are annual.** `PropertyCard` appends `/year` when `purpose` is
`for-rent` so the figure is not mistaken for a monthly rent.

---

## Verified location IDs

Exported as `LOCATIONS` from `lib/bayut.ts`.

| Area | ID |
|---|---|
| Dubai (whole emirate) | 5002 |
| Abu Dhabi (whole emirate) | 6020 |
| JVC | 5416 |
| Business Bay | 5093 |
| Downtown Dubai | 6901 |
| Dubai Marina | 5003 |
| Dubai Hills Estate | 8288 |
| JLT | 5152 |
| Palm Jumeirah | 5460 |

A wrong location ID returns a **different area** rather than an error, so
confirm any you add through `/autocomplete` rather than guessing.

---

## Caching

Requests set `next: { revalidate: 300 }`, so Next caches responses for five
minutes. Listings change often enough that indefinite caching would show stale
prices, and often enough that no caching burns quota. Adjust in `lib/bayut.ts`
to suit your plan.

---

## Deploying to Vercel

1. Push your fork to GitHub
2. Import it in Vercel
3. Add `RAPIDAPI_KEY` as an environment variable, not prefixed `NEXT_PUBLIC_`
4. Deploy

The route handlers run as serverless functions, so the key stays server side.

---

## FAQ

### Can I call the Bayut API directly from a client component?

You can, but do not. It would require shipping the key to the browser. Use a
route handler, as this example does.

### Why is my search returning a different area?

Almost certainly a wrong location ID. The API returns results for whatever ID
you send rather than rejecting an unknown one. Use `/api/locations` to confirm.

### Does this work with the Pages Router?

The client in `lib/bayut.ts` does, unchanged. The route handlers would need
rewriting as `pages/api` handlers, and `next: { revalidate }` has no effect
outside the App Router.

### Is there a Python version?

Yes.
[bayut-api-python-examples](https://github.com/happyendpointhq/bayut-api-python-examples).

---

## Using the API from Claude, Cursor, or another MCP client

RapidAPI hosts an MCP server, so you can query this API from an AI assistant
without writing code:

```json
{
  "mcpServers": {
    "Bayut UAE Real Estate": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://mcp.rapidapi.com",
        "--header",
        "x-api-host: uae-real-estate3.p.rapidapi.com",
        "--header",
        "x-api-key: YOUR_RAPIDAPI_KEY"
      ]
    }
  }
}
```

---

## Related repos

- [bayut-api](https://github.com/happyendpointhq/bayut-api) - full endpoint documentation
- [bayut-api-python-examples](https://github.com/happyendpointhq/bayut-api-python-examples) - the same patterns in Python
- [bayut-api-postman-collection](https://github.com/happyendpointhq/bayut-api-postman-collection) - try the endpoints without writing code
- [dubai-rental-yield-calculator](https://github.com/happyendpointhq/dubai-rental-yield-calculator) - yields by area
- [uae-real-estate-data-guide](https://github.com/happyendpointhq/uae-real-estate-data-guide) - every route to UAE property data

---

## Disclaimer

Happy Endpoint is an independent provider. This project is **not affiliated
with, endorsed by, sponsored by, or connected to** any of the websites,
platforms, retailers, or marketplaces referenced here or reachable through the
underlying APIs.

All product names, brands, trademarks, and registered trademarks are the
property of their respective owners. Any reference to them is descriptive only,
to identify the subject matter of the data, and does not imply any association
or endorsement.

Users are responsible for ensuring their use of any data complies with
applicable laws and the terms of service of the relevant source.

---

## About Happy Endpoint

[Happy Endpoint](https://happyendpoint.com) builds and maintains real-time data
APIs for property portals, retailers, and marketplaces. All APIs are available on
RapidAPI with a free tier.

- Catalogue: [happyendpoint.com/library](https://happyendpoint.com/library)
- Datasets: [happyendpoint.com/datasets](https://happyendpoint.com/datasets)
- Documentation: [docs.happyendpoint.com](https://docs.happyendpoint.com)
- Contact: happyendpointhq@gmail.com

## Licence

MIT. See [LICENSE](LICENSE).
