const notices: Record<string, string> = {
  delivery_received: "Delivery accepted. Its balanced ledger receipt and payment obligation were created atomically.",
  delivery_settled: "Settlement evidence recorded. The delivery remains immutable operational history.",
  offer_created: "Guaranteed purchase offer published with its effective period.",
  price_saved: "Buying price saved. It will be used automatically for future material purchases.",
  policy_saved: "Supply and reserve policy updated with an audited reason.",
  supplier_registered: "Supplier registered and assigned a stable Company reference.",
};
const errors: Record<string, string> = {
  access_denied: "Your current assignment does not permit that economic operation.",
  conflict: "The record changed first. Reload before trying again.",
  invalid_input: "Check the item and enter a positive whole-number price.",
  not_found: "The selected current supplier, offer, warehouse, or delivery could not be found.",
  player_source_required: "This keystone material can enter stock only through a recorded supplier delivery.",
  save_failed: "The command was rejected. No partial procurement or inventory state was accepted.",
};
export function EconomyNotice({ error, notice }: { error?: string; notice?: string }) {
  const message = (error && errors[error]) || (notice && notices[notice]);
  if (!message) return null;
  return <div className={`staff-flash ${error ? "staff-flash-error" : ""}`} role={error ? "alert" : "status"}>{message}</div>;
}
