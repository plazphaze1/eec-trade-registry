interface CatalogueUnavailableProps {
  notConfigured?: boolean;
}

export function CatalogueUnavailable({
  notConfigured = false,
}: CatalogueUnavailableProps) {
  return (
    <section className="notice-panel" role="status">
      <p className="eyebrow">Please try again</p>
      <h2>The public catalogue is temporarily unavailable.</h2>
      <p>
        We could not load the latest catalogue. Refresh this page in a few
        minutes.
      </p>
      {notConfigured && process.env.NODE_ENV === "development" && (
        <p className="development-note">
          Development setup: configure the public Supabase URL and anon key in
          your local environment.
        </p>
      )}
    </section>
  );
}
