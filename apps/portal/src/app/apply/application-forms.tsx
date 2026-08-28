"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  checkApplicationAction,
  submitApplicationAction,
  type ApplicationState,
} from "@/app/apply/actions";
import { ReferenceBlock } from "@/components/reference-block";
import type { ApplicationOptions } from "@/lib/license-application";
import { REGISTRY_CONFIG } from "@/lib/registry-config";

const initial: ApplicationState = {};

export function ApplicationForms({
  mode,
  options,
}: {
  mode: "new" | "renewal";
  options: ApplicationOptions;
}) {
  const [state, submit, pending] = useActionState(submitApplicationAction, initial);
  const [lookup, check, checking] = useActionState(checkApplicationAction, initial);
  const jurisdiction = options.jurisdictions.find(
    (item) => item.code === REGISTRY_CONFIG.jurisdiction.code,
  );
  const defaultLicenseClass = options.license_classes.find(
    (item) => item.code === REGISTRY_CONFIG.licensing.defaultClassCode,
  ) ?? options.license_classes[0];
  const groups = options.endorsements.reduce<
    Array<{ label: string; options: ApplicationOptions["endorsements"] }>
  >((result, endorsement) => {
    const existing = result.find((group) => group.label === endorsement.group);
    if (existing) existing.options.push(endorsement);
    else result.push({ label: endorsement.group, options: [endorsement] });
    return result;
  }, []);
  const ordinaryEndorsements = groups[0];
  const specialEndorsements = groups.slice(1);

  return (
    <div className="application-workspace">
      {state.reference && state.token ? (
        <section className="application-receipt" aria-live="polite">
          <p className="eyebrow">Application received</p>
          <h2>Save these two values.</h2>
          <p>You will need both of them to check the result later.</p>
          <ReferenceBlock label="Application reference" reference={state.reference} status="Submitted" />
          <ReferenceBlock label="Private status token · shown once" reference={state.token} />
        </section>
      ) : (
        <section className="application-intake">
          <nav aria-label="Choose a licensing task" className="application-task-picker">
            <Link aria-current={mode === "new" ? "page" : undefined} href="/apply">
              <strong>Get a new license</strong>
              <small>For a business applying for the first time</small>
            </Link>
            <Link aria-current={mode === "renewal" ? "page" : undefined} href="/apply?task=renew">
              <strong>Renew a license</strong>
              <small>For a business that already has a LIC number</small>
            </Link>
          </nav>

          {mode === "renewal" ? (
            <form action={submit} className="verification-form application-form application-renewal-form">
              <input name="application_type" type="hidden" value="renewal" />
              <input aria-hidden="true" autoComplete="off" className="form-honeypot" name="website" tabIndex={-1} />
              <div className="application-form-heading">
                <p className="eyebrow">Renew a license</p>
                <h2>Enter the license number.</h2>
                <p>That is all we need. The existing business and permissions are copied automatically.</p>
              </div>
              <label className="field simple-primary-field">
                <span>License number</span>
                <input autoComplete="off" maxLength={128} name="existing_license_reference" placeholder="EEC-LIC-…" required spellCheck={false} />
              </label>
              {state.error && <p className="staff-flash staff-flash-error" role="alert">{state.error}</p>}
              <button className="button button-primary" disabled={pending}>{pending ? "Sending…" : "Send renewal request"}</button>
            </form>
          ) : (
            <form action={submit} className="verification-form application-form simple-application-form">
              <input name="application_type" type="hidden" value="new" />
              <input aria-hidden="true" autoComplete="off" className="form-honeypot" name="website" tabIndex={-1} />
              {jurisdiction && <input name="jurisdiction_code" type="hidden" value={jurisdiction.code} />}
              {defaultLicenseClass && <input name="license_class_code" type="hidden" value={defaultLicenseClass.code} />}
              <div className="application-form-heading">
                <p className="eyebrow">New business license</p>
                <h2>Tell us about the business.</h2>
                <p>Staff will review this before any license is issued.</p>
              </div>
              <label className="field">
                <span>Business name</span>
                <input autoComplete="organization" maxLength={200} name="applicant_name" required />
              </label>
              <label className="field">
                <span>Your Discord name</span>
                <input autoComplete="username" maxLength={300} name="contact_label" required />
              </label>

              {ordinaryEndorsements && (
                <fieldset className="application-category-picker">
                  <legend>What will the business sell?</legend>
                  <p>Choose everything that applies.</p>
                  <div>{ordinaryEndorsements.options.map((item) => (
                    <label key={item.code}>
                      <input name="endorsement_codes" type="checkbox" value={item.code} />
                      <span>{item.label}</span>
                    </label>
                  ))}</div>
                </fieldset>
              )}

              {specialEndorsements.length > 0 && (
                <details className="application-special-permissions">
                  <summary>Does the business need special permissions?</summary>
                  <p>Most businesses can leave this closed. Choose these only for bulk, consignment, controlled, or individually tracked goods.</p>
                  {specialEndorsements.map((group) => (
                    <fieldset className="endorsement-group" key={group.label}>
                      <legend>{group.label}</legend>
                      {group.options.map((item) => (
                        <label className="staff-checkbox" key={item.code}>
                          <input name="endorsement_codes" type="checkbox" value={item.code} />
                          <span><strong>{item.label}</strong><small>{item.description}</small></span>
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </details>
              )}

              <label className="field application-purpose">
                <span>What does the business do?</span>
                <textarea maxLength={4000} minLength={10} name="statement" placeholder="Example: We make and sell clothing in Solitude." required rows={3} />
              </label>
              {(!jurisdiction || !defaultLicenseClass) && <p className="staff-flash staff-flash-error" role="alert">New applications are temporarily paused because the standard license setup is incomplete.</p>}
              {state.error && <p className="staff-flash staff-flash-error" role="alert">{state.error}</p>}
              <button className="button button-primary application-submit" disabled={pending || !jurisdiction || !defaultLicenseClass}>{pending ? "Sending…" : "Send application"}</button>
            </form>
          )}
        </section>
      )}

      <details className="application-status-check">
        <summary><strong>Already applied?</strong><span>Check the result</span></summary>
        <div>
          <p>Enter the two values from your application receipt.</p>
          <form action={check} className="verification-form">
            <label className="field"><span>Application reference</span><input name="reference" required /></label>
            <label className="field"><span>Private status token</span><input name="token" required /></label>
            {lookup.error && <p className="staff-flash staff-flash-error" role="alert">{lookup.error}</p>}
            {lookup.status && lookup.reference && <ReferenceBlock label="Application reference" reference={lookup.reference} status={lookup.status.replaceAll("_", " ")} />}
            <button className="button button-secondary" disabled={checking}>{checking ? "Checking…" : "Check status"}</button>
          </form>
        </div>
      </details>
    </div>
  );
}
