# Bayut API Javascript NextJs

JavaScript and Next.js examples for the [Bayut Property Data API](https://rapidapi.com/happyendpoint/api/uae-real-estate3/) - search Dubai and UAE property listings, build location autocomplete, fetch agent data, and display off-plan projects.

Built by [Happy Endpoint](https://happyendpoint.com) - docs at [bayutapi.dev](https://bayutapi.dev).

---

## What is the Bayut API?

The Bayut API gives you programmatic access to UAE property data - listings for sale and rent, off-plan projects, agents, agencies, and transaction history. No scraping, no proxies, clean JSON.

Available on RapidAPI: https://rapidapi.com/happyendpoint/api/uae-real-estate3/

---

## Setup

Get your API key by subscribing on RapidAPI (free plan available).

For Next.js projects, add to `.env.local`:

```
RAPIDAPI_KEY=your_key_here
```

For plain Node.js, use a `.env` file with `dotenv`.

---

## Examples

### Fetch wrapper (reusable)

Put this in `lib/bayut.js` or `lib/bayut.ts`:

```javascript
const BASE_URL = "https://uae-real-estate3.p.rapidapi.com";

const defaultHeaders = {
  "x-rapidapi-host": "uae-real-estate3.p.rapidapi.com",
  "x-rapidapi-key": process.env.RAPIDAPI_KEY
};

async function bayutFetch(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    headers: defaultHeaders,
    next: { revalidate: 300 } // Next.js cache - 5 minutes
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json();
}

export async function searchLocations(query, langs = "en") {
  const data = await bayutFetch("/autocomplete", { query, langs });
  return data.data.locations;
}

export async function searchProperties({
  purpose = "for-sale",
  locationId,
  propertyType,
  rooms,
  baths,
  priceMin,
  priceMax,
  areaMin,
  areaMax,
  completionStatus,
  isFurnished,
  amenities,
  sortOrder = "popular",
  page = 1,
  langs = "en"
} = {}) {
  const data = await bayutFetch("/search-property", {
    purpose,
    location_ids: locationId,
    property_type: propertyType,
    rooms,
    baths,
    price_min: priceMin,
    price_max: priceMax,
    area_min: areaMin,
    area_max: areaMax,
    completion_status: completionStatus,
    is_furnished: isFurnished,
    amenities,
    sort_order: sortOrder,
    page,
    langs
  });
  return data.data;
}

export async function getPropertyDetails(externalId, langs = "en") {
  const data = await bayutFetch("/property-details", {
    external_id: externalId,
    langs
  });
  return data.data;
}

export async function searchOffPlan({
  locationId,
  completionPercentage,
  maxPreHandover,
  priceMax,
  rooms,
  page = 1
} = {}) {
  const data = await bayutFetch("/search-new-projects", {
    location_ids: locationId,
    property_type: "residential",
    completion_percentage: completionPercentage,
    pre_handover_payment: maxPreHandover,
    price_max: priceMax,
    rooms,
    sort_order: "latest",
    page
  });
  return data.data;
}

export async function getTransactions({
  purpose = "for-sale",
  locationId,
  timePeriod = "12m",
  categoryIds,
  completionStatus,
  page = 1
} = {}) {
  const data = await bayutFetch("/transactions", {
    purpose,
    location_ids: locationId,
    time_period: timePeriod,
    category_ids: categoryIds,
    completion_status: completionStatus,
    sort: "date_desc",
    page
  });
  return data.data;
}

export async function searchAgents({
  locationId,
  purpose = "for-sale",
  category = "residential",
  page = 1
} = {}) {
  const data = await bayutFetch("/agent-search", {
    location_ids: locationId,
    purpose,
    category,
    page,
    langs: "en"
  });
  return data.data;
}
```

---

### Next.js API routes

Keep your RapidAPI key server-side. Never expose it in client components.

**app/api/locations/route.js**

```javascript
import { NextResponse } from "next/server";
import { searchLocations } from "@/lib/bayut";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";

  if (query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const locations = await searchLocations(query);
    return NextResponse.json(locations);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**app/api/properties/route.js**

```javascript
import { NextResponse } from "next/server";
import { searchProperties } from "@/lib/bayut";

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  try {
    const data = await searchProperties({
      purpose: searchParams.get("purpose") || "for-sale",
      locationId: searchParams.get("locationId"),
      propertyType: searchParams.get("propertyType"),
      rooms: searchParams.get("rooms"),
      priceMin: searchParams.get("priceMin"),
      priceMax: searchParams.get("priceMax"),
      sortOrder: searchParams.get("sortOrder") || "popular",
      page: Number(searchParams.get("page")) || 1
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

### Location search component

```jsx
"use client";

import { useState, useCallback, useRef } from "react";

export function LocationSearch({ onSelect, placeholder = "Search area..." }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);

  const search = useCallback((value) => {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/locations?query=${encodeURIComponent(value)}`);
        const data = await res.json();
        setResults(data);
        setOpen(true);
      } catch (err) {
        console.error("Location search failed:", err);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  function handleSelect(location) {
    setQuery(location.name?.en || "");
    setResults([]);
    setOpen(false);
    onSelect(location);
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        value={query}
        onChange={(e) => search(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", padding: "10px 14px", fontSize: "16px" }}
      />
      {loading && <span style={{ position: "absolute", right: 12, top: 12 }}>...</span>}
      {open && results.length > 0 && (
        <ul style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          background: "#fff",
          border: "1px solid #ddd",
          borderRadius: "6px",
          listStyle: "none",
          margin: 0,
          padding: 0,
          zIndex: 100,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
        }}>
          {results.map((loc) => (
            <li
              key={loc.externalID}
              onClick={() => handleSelect(loc)}
              style={{
                padding: "10px 14px",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                borderBottom: "1px solid #f0f0f0"
              }}
            >
              <span>{loc.name?.en}</span>
              <span style={{ color: "#999", fontSize: "13px" }}>
                {loc.adCount?.toLocaleString()} listings
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

### Property card component

```jsx
export function PropertyCard({ property }) {
  const title = property.title?.en || "Property";
  const price = property.price;
  const rooms = property.rooms;
  const baths = property.baths;
  const areaSqm = property.area;
  const areaSqft = areaSqm ? Math.round(areaSqm * 10.764) : null;
  const photo = property.coverPhoto?.url;
  const purpose = property.purpose;
  const isVerified = property.isVerified;
  const location = property.location;
  const neighbourhood = location?.find((l) => l.level === 2)?.name?.en;

  return (
    <article style={{
      border: "1px solid #e0e0e0",
      borderRadius: "10px",
      overflow: "hidden",
      background: "#fff"
    }}>
      {photo && (
        <img
          src={photo}
          alt={title}
          style={{ width: "100%", height: "200px", objectFit: "cover" }}
        />
      )}
      <div style={{ padding: "14px" }}>
        {isVerified && (
          <span style={{
            background: "#e8f5e9",
            color: "#2e7d32",
            fontSize: "11px",
            padding: "2px 8px",
            borderRadius: "4px",
            marginBottom: "8px",
            display: "inline-block"
          }}>
            Verified
          </span>
        )}
        <h3 style={{ fontSize: "15px", marginBottom: "6px", lineHeight: 1.4 }}>
          {title}
        </h3>
        {neighbourhood && (
          <p style={{ color: "#666", fontSize: "13px", marginBottom: "8px" }}>
            {neighbourhood}
          </p>
        )}
        <p style={{ fontSize: "18px", fontWeight: "bold", color: "#1a1a1a", marginBottom: "8px" }}>
          AED {price?.toLocaleString()}
          {purpose === "for-rent" && <span style={{ fontSize: "13px", fontWeight: "normal" }}>/year</span>}
        </p>
        <div style={{ display: "flex", gap: "16px", color: "#555", fontSize: "13px" }}>
          {rooms !== null && <span>{rooms === 0 ? "Studio" : `${rooms} bed`}</span>}
          {baths && <span>{baths} bath</span>}
          {areaSqft && <span>{areaSqft.toLocaleString()} sqft</span>}
        </div>
      </div>
    </article>
  );
}
```

---

### Property listing page (Next.js App Router)

```jsx
// app/properties/page.jsx
import { searchProperties } from "@/lib/bayut";
import { PropertyCard } from "@/components/PropertyCard";

export default async function PropertiesPage({ searchParams }) {
  const {
    purpose = "for-sale",
    locationId,
    propertyType,
    rooms,
    priceMin,
    priceMax,
    page = "1"
  } = searchParams;

  const data = await searchProperties({
    purpose,
    locationId,
    propertyType,
    rooms,
    priceMin,
    priceMax,
    page: Number(page)
  });

  return (
    <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
      <h1 style={{ marginBottom: "8px" }}>
        Properties {purpose === "for-sale" ? "for Sale" : "for Rent"}
      </h1>
      <p style={{ color: "#666", marginBottom: "24px" }}>
        {data.total.toLocaleString()} properties found
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: "20px"
      }}>
        {data.properties.map((property) => (
          <a
            key={property.externalID}
            href={`/property/${property.externalID}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <PropertyCard property={property} />
          </a>
        ))}
      </div>

      {/* Pagination */}
      <div style={{ marginTop: "32px", display: "flex", gap: "8px" }}>
        {Number(page) > 1 && (
          <a href={`?${new URLSearchParams({ ...searchParams, page: Number(page) - 1 })}`}>
            Previous
          </a>
        )}
        <span>Page {page} of {data.totalPages}</span>
        {Number(page) < data.totalPages && (
          <a href={`?${new URLSearchParams({ ...searchParams, page: Number(page) + 1 })}`}>
            Next
          </a>
        )}
      </div>
    </main>
  );
}
```

---

### Property detail page

```jsx
// app/property/[id]/page.jsx
import { getPropertyDetails } from "@/lib/bayut";
import { notFound } from "next/navigation";

export default async function PropertyPage({ params }) {
  const property = await getPropertyDetails(params.id).catch(() => null);

  if (!property) notFound();

  const title = property.title?.en;
  const price = property.price;
  const rooms = property.rooms;
  const baths = property.baths;
  const areaSqm = property.area;
  const areaSqft = areaSqm ? Math.round(areaSqm * 10.764) : null;
  const description = property.description?.en;
  const amenities = property.amenities || [];
  const agent = property.ownerAgent;
  const agency = property.agency;
  const location = property.location;
  const neighbourhood = location?.find((l) => l.level === 2)?.name?.en;

  return (
    <main style={{ maxWidth: "900px", margin: "0 auto", padding: "24px" }}>
      <h1>{title}</h1>
      {neighbourhood && <p style={{ color: "#666" }}>{neighbourhood}, Dubai</p>}

      <p style={{ fontSize: "28px", fontWeight: "bold", margin: "16px 0" }}>
        AED {price?.toLocaleString()}
      </p>

      <div style={{ display: "flex", gap: "24px", marginBottom: "24px" }}>
        {rooms !== null && <span>{rooms === 0 ? "Studio" : `${rooms} Bedrooms`}</span>}
        {baths && <span>{baths} Bathrooms</span>}
        {areaSqft && <span>{areaSqft.toLocaleString()} sqft</span>}
        <span>{property.completionStatus}</span>
        <span>{property.furnishingStatus}</span>
      </div>

      {description && (
        <div style={{ marginBottom: "24px" }}>
          <h2>Description</h2>
          <p style={{ whiteSpace: "pre-line" }}>{description}</p>
        </div>
      )}

      {amenities.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <h2>Amenities</h2>
          <ul style={{ columns: 2, listStyle: "disc", paddingLeft: "20px" }}>
            {amenities.map((a, i) => (
              <li key={i}>{a.text}</li>
            ))}
          </ul>
        </div>
      )}

      {agent && (
        <div style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "16px" }}>
          <h2>Listed by</h2>
          <p>{agent.name}</p>
          {agency && <p style={{ color: "#666" }}>{agency.name}</p>}
        </div>
      )}
    </main>
  );
}
```

---

### Fetch with error handling and retry

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        // Rate limited - wait before retrying
        const waitMs = Math.pow(2, attempt) * 1000;
        console.warn(`Rate limited. Waiting ${waitMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      console.warn(`Attempt ${attempt + 1} failed: ${err.message}`);
    }
  }
}
```

---

### TypeScript types

```typescript
// types/bayut.ts

export interface Location {
  id: number;
  externalID: string;
  name: Record<string, string>;
  slug: Record<string, string>;
  level: number;
  type: string;
  path: string;
  adCount: number;
}

export interface Property {
  id: string;
  externalID: string;
  title: Record<string, string>;
  description?: Record<string, string>;
  purpose: "for-sale" | "for-rent";
  price: number;
  rentFrequency?: string;
  rooms: number;
  baths: number;
  area: number;
  completionStatus: string;
  furnishingStatus: string;
  isVerified: boolean;
  referenceNumber: string;
  coverPhoto?: { url: string };
  location?: Location[];
  amenities?: Array<{ text: string }>;
  ownerAgent?: Agent;
  agency?: Agency;
  geography?: { lat: number; lng: number };
  createdAt: number;
  updatedAt: number;
}

export interface Agent {
  externalID: string;
  name: string;
  agency?: Agency;
  languages?: string[];
  listingCount?: number;
}

export interface Agency {
  externalID: string;
  name: string;
  listingCount?: number;
}

export interface SearchResult {
  properties: Property[];
  total: number;
  page: number;
  totalPages: number;
  hitsPerPage: number;
}
```

---

## Common location IDs

| Area | externalID |
|---|---|
| Dubai (whole emirate) | 1 |
| Abu Dhabi (whole emirate) | 3 |
| Dubai Marina | 5003 |
| Downtown Dubai | 6901 |
| Palm Jumeirah | 5002 |
| Business Bay | 5460 |
| JVC | 6388 |
| JLT | 5006 |
| Dubai Hills Estate | 11621 |

Use `/autocomplete` to find IDs for any other area.

---

## Links

- API on RapidAPI: https://rapidapi.com/happyendpoint/api/uae-real-estate3/
- Full documentation: https://bayutapi.dev
- Happy Endpoint: https://happyendpoint.com
- Twitter: https://x.com/happyendpointhq
- Email: happyendpointhq@gmail.com

Need bulk Bayut data (100K+ records)? Email happyendpointhq@gmail.com

---

## License

MIT
