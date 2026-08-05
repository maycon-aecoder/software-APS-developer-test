import React from 'react';

const REPORT_CATEGORIES = Object.freeze([
  { category: 'Doors', singular: 'Door' },
  { category: 'Windows', singular: 'Window' },
]);

function formatArea(total, unit) {
  return unit ? `${total} ${unit}` : String(total);
}

function QuantityCard({ category, quantity, singular }) {
  const headingId = `aps-quantity-${category.toLowerCase()}`;
  if (!quantity) {
    return (
      <article aria-labelledby={headingId} aria-live="polite" className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <h3 id={headingId} className="font-semibold text-gray-800">{category}</h3>
        <p className="mt-2 text-sm text-gray-600">Waiting for model analysis.</p>
      </article>
    );
  }

  if (quantity.status === 'failed') {
    return (
      <article aria-labelledby={headingId} className="rounded-xl border border-red-200 bg-red-50 p-4">
        <h3 id={headingId} className="font-semibold text-gray-800">{category}</h3>
        <dl className="mt-2 text-sm"><dt className="inline font-medium">Count</dt>{' '}<dd className="inline">Unavailable</dd></dl>
        <p role="alert" className="mt-2 text-sm text-red-700">
          {singular} quantity could not be determined. Retry loading the model or verify its category structure.
        </p>
      </article>
    );
  }

  const area = quantity.area;
  return (
    <article
      aria-labelledby={headingId}
      aria-live={area?.status === 'failed' ? undefined : 'polite'}
      className="rounded-xl border border-gray-200 bg-gray-50 p-4"
    >
      <h3 id={headingId} className="font-semibold text-gray-800">{category}</h3>
      <dl className="mt-2 space-y-1 text-sm text-gray-700">
        <div><dt className="inline font-medium">Count</dt>{' '}<dd className="inline">{quantity.count}</dd></div>
        {area?.status === 'loading' && (
          <div><dt className="sr-only">Area</dt><dd>Calculating Area…</dd></div>
        )}
        {area?.status === 'complete' && (
          <div><dt className="inline font-medium">Area</dt>{' '}<dd className="inline">{formatArea(area.total, area.unit)}</dd></div>
        )}
        {area?.status === 'partial' && (
          <div><dt className="inline font-medium">Area subtotal</dt>{' '}<dd className="inline">{formatArea(area.total, area.unit)}</dd></div>
        )}
        {area?.status === 'unavailable' && (
          <div><dt className="inline font-medium">Area</dt>{' '}<dd className="inline">Unavailable</dd></div>
        )}
        {area?.status === 'failed' && (
          <div><dt className="inline font-medium">Area</dt>{' '}<dd className="inline">Unavailable</dd></div>
        )}
      </dl>
      {area?.status === 'partial' && (
        <p className="mt-2 text-sm text-amber-800">
          Some {singular} elements do not provide one usable Area value.
        </p>
      )}
      {area?.status === 'unavailable' && quantity.count === 0 && (
        <p className="mt-2 text-sm text-gray-600">No {singular} elements were found in this model.</p>
      )}
      {area?.status === 'unavailable' && quantity.count > 0 && (
        <p className="mt-2 text-sm text-gray-600">
          A safe {singular} Area total is unavailable because the model values or units are incomplete or incompatible.
        </p>
      )}
      {area?.status === 'failed' && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          The {singular} count is available, but its Area could not be calculated. Retry loading the model.
        </p>
      )}
    </article>
  );
}

export default function ApsQuantityReport({ quantities = {} }) {
  return (
    <section aria-label="Door and Window quantities" className="border-t border-gray-200 p-4">
      <h2 className="text-lg font-semibold text-gray-900">Model quantities</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {REPORT_CATEGORIES.map(({ category, singular }) => (
          <QuantityCard
            key={category}
            category={category}
            quantity={quantities[category]}
            singular={singular}
          />
        ))}
      </div>
    </section>
  );
}
