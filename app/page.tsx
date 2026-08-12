'use client';

import { useState } from 'react';

import LocationSearch from '@/components/LocationSearch';
import PropertyCard, { type PropertyCardData } from '@/components/PropertyCard';

export default function Home() {
  const [properties, setProperties] = useState<PropertyCardData[]>([]);
  const [total, setTotal] = useState(0);
  const [purpose, setPurpose] = useState<'for-sale' | 'for-rent'>('for-sale');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function search(locationId: string) {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const params = new URLSearchParams({ locationId, purpose });
      const res = await fetch(`/api/properties?${params}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Search failed');
      setProperties(body.properties ?? []);
      setTotal(body.total ?? 0);
    } catch (err) {
      setError((err as Error).message);
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }

  const [locationId, setLocationId] = useState<string | null>(null);

  return (
    <main>
      <h1>Dubai Property Search</h1>
      <p>Live listings from the Bayut API.</p>

      <div className="controls">
        <LocationSearch
          onSelect={(location) => {
            setLocationId(location.id);
            search(location.id);
          }}
        />

        <select
          value={purpose}
          onChange={(event) => {
            const next = event.target.value as 'for-sale' | 'for-rent';
            setPurpose(next);
            if (locationId) search(locationId);
          }}
          aria-label="Purpose"
        >
          <option value="for-sale">For sale</option>
          <option value="for-rent">For rent</option>
        </select>
      </div>

      {loading && <p>Searching...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && searched && !error && (
        <p>
          {total.toLocaleString()} listings found, showing {properties.length}
        </p>
      )}

      <div className="grid">
        {properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </main>
  );
}
