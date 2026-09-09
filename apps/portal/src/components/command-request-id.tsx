export function CommandRequestId() {
  return <input name="request_id" type="hidden" value={crypto.randomUUID()} />;
}
