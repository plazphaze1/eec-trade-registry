interface VerificationFormProps {
  reference: string | null;
}

export function VerificationForm({ reference }: VerificationFormProps) {
  return (
    <form className="verification-form verification-form-single" action="/verify" method="get">
      <label className="field" htmlFor="verification-reference">
        <span>Business or license number</span>
        <input
          id="verification-reference"
          name="reference"
          defaultValue={reference ?? ""}
          maxLength={128}
          autoComplete="off"
          spellCheck={false}
          required
          placeholder="EEC-DLR-… or EEC-LIC-…"
        />
      </label>
      <button className="button" type="submit">
        Verify record
      </button>
      <p>
        A business number begins with EEC-DLR-. A license number begins with
        EEC-LIC-. Names cannot be searched.
      </p>
    </form>
  );
}
