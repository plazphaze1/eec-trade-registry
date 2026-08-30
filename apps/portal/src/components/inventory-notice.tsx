const notices: Record<string, string> = {
  expired: "The expired hold was cleared and the goods are available again.",
  extended: "The order hold was extended.",
  receipt_posted: "Stock added successfully.",
  sale_price_saved: "The new selling price is ready for future orders.",
  price_saved: "The new Company buying price is ready for future purchases.",
  delivery_received: "The player purchase was recorded and the stock was added.",
  supplier_registered: "Seller saved. You can now record the purchase.",
  released: "The goods are available again.",
  reservation_created: "The goods are ready for the customer.",
  reversed: "The stock correction was recorded.",
};

const errors: Record<string, string> = {
  access_denied: "Your current assignment does not permit that warehouse action.",
  conflict: "The record changed first. Reload its current version before trying again.",
  insufficient_stock: "That quantity is no longer available.",
  invalid_input: "Check the highlighted amount and try again.",
  not_found: "That stock record is no longer available.",
  player_source_required: "Use Buy materials to receive this player-supplied material.",
  save_failed: "Stock could not be updated. Nothing was changed; please try again.",
};

export function InventoryNotice({ error, notice }: { error?: string; notice?: string }) {
  const errorMessage = error ? errors[error] : undefined;
  const noticeMessage = notice ? notices[notice] : undefined;
  if (!errorMessage && !noticeMessage) return null;
  return (
    <div
      className={`staff-flash ${errorMessage ? "staff-flash-error" : ""}`}
      role={errorMessage ? "alert" : "status"}
    >
      {errorMessage ?? noticeMessage}
    </div>
  );
}
