'use client';

import { useEffect, useState } from 'react';

interface LocationOption {
  id: string;
  name: string;
  listings: number;
}

interface Props {
  onSelect: (location: LocationOption) => void;
  placeholder?: string;
}

/**
 * Debounced location autocomplete.
 *
 * Calls our own /api/locations route rather than the Bayut API directly, so the
 * RapidAPI key stays on the server.
 */
export default function LocationSearch({ onSelect, placeholder = 'Search an area' }: Props) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setOptions([]);
      return;
    }

    // Debounce, and abort in-flight requests so a fast typist does not race
    // stale responses into the list.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/locations?query=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'Lookup failed');
        setOptions(body.locations ?? []);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="location-search">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        aria-label="Search an area"
      />

      {loading && <p className="hint">Searching...</p>}
      {error && <p className="error">{error}</p>}

      {options.length > 0 && (
        <ul className="results">
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(option);
                  setQuery(option.name);
                  setOptions([]);
                }}
              >
                <span>{option.name}</span>
                <span className="count">{option.listings.toLocaleString()} listings</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
