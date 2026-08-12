export interface PropertyCardData {
  id: string;
  title: string;
  price: number;
  rooms?: number | null;
  baths?: number | null;
  areaSqm?: number | null;
  purpose?: string;
  verified?: boolean;
  completionStatus?: string;
  location?: string;
  image?: string | null;
}

const SQM_TO_SQFT = 10.7639;

function formatPrice(price: number, purpose?: string) {
  if (!price) return 'Price on application';
  const formatted = new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(price);
  // For rentals the API price is the annual figure, so label it as such.
  return purpose === 'for-rent' ? `${formatted}/year` : formatted;
}

export default function PropertyCard({ property }: { property: PropertyCardData }) {
  const { title, price, rooms, baths, areaSqm, verified, location, image, purpose } = property;

  return (
    <article className="property-card">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={title} loading="lazy" width={400} height={300} />
      ) : (
        <div className="placeholder" aria-hidden="true" />
      )}

      <div className="body">
        <h3>{title || 'Untitled listing'}</h3>

        <p className="price">
          {formatPrice(price, purpose)}
          {verified && <span className="badge">Verified</span>}
        </p>

        <p className="spec">
          {[
            rooms != null ? `${rooms} bed` : null,
            baths != null ? `${baths} bath` : null,
            areaSqm ? `${areaSqm} sqm (${Math.round(areaSqm * SQM_TO_SQFT)} sqft)` : null,
          ]
            .filter(Boolean)
            .join(' | ')}
        </p>

        {location && <p className="location">{location}</p>}
      </div>
    </article>
  );
}
