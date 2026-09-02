const notices: Record<string, string> = {
  control_created: "The control profile is ready to use.",
  reference_created: "The configuration option is immediately available in staff forms.",
};

const errors: Record<string, string> = {
  access_denied: "Your active EEC roles do not grant every permission required for that operation.",
  conflict: "Someone changed this record first. Reload before trying again.",
  duplicate: "That code or name is already in use.",
  invalid_input: "Check the highlighted workflow fields. No records were changed.",
  not_found: "The selected item or location is unavailable for that operation.",
  save_failed: "The authoritative operation failed. No partial change was kept.",
};

export function ConfigurationNotice({ error, notice }: { error?: string; notice?: string }) {
  if (error && errors[error]) return <p className="form-error" role="alert">{errors[error]}</p>;
  if (notice && notices[notice]) return <p className="form-success" role="status">{notices[notice]}</p>;
  return null;
}
