const notices: Record<string, string> = {
  cancelled: "Order cancelled.",
  line_priced: "Price updated.",
  line_reviewed: "Order updated.",
  reservation_created: "The order is ready for the customer.",
  fulfilled: "Order completed and stock updated.",
  prepared: "The order is ready for the customer.",
  backordered: "The order is saved and will stay open until stock arrives.",
  submitted: "Order placed successfully.",
};

const errors: Record<string, string> = {
  access_denied: "You do not have permission to do that.",
  conflict: "This order changed. Refresh and try again.",
  invalid_input: "Check the customer, goods, and quantities.",
  insufficient_stock: "That quantity is no longer in stock. The order remains open.",
  not_found: "That order is no longer available.",
  save_failed: "The order could not be updated. Please try again.",
};

export function OrderNotice({
  error,
  notice,
}: {
  error?: string;
  notice?: string;
}) {
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
