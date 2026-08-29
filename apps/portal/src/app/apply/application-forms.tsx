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
              <strong>I need a new license</strong>
              <small>My business has never had one</small>
            </Link>
            <Link aria-current={mode === "renewal" ? "page" : undefined} href="/apply?task=renew">
              <strong>I already have a license</strong>
              <small>Renew using my LIC number</small>
            </Link>
          </nav>

          {mode === "renewal" ? (
            <form action={submit} className="verification-form application-form application-renewal-form">
              <input name="application_type" type="hidden" value="renewal" />
              <input aria-hidden="true" autoComplete="off" className="form-honeypot" name="website" tabIndex={-1} />
              <div className="application-form-heading">
                <p className="eyebrow">Renew a license</p>
                <h2>What is your license number?</h2>
                <p>We will copy the existing business details. This is the only question.</p>
              </div>
              <label className="field simple-primary-field">
                <span>Your LIC number</span>
                <input autoComplete="off" maxLength={128} name="existing_license_reference" placeholder="EEC-LIC-…" required spellCheck={false} />
              </label>
              {state.error && <p className="staff-flash staff-flash-error" role="alert">{state.error}</p>}
              <button className="button button-primary" disabled={pending}>{pending ? "Sending…" : "Ask to renew"}</button>
            </form>
          ) : (
            <form action={submit} className="verification-form application-form simple-application-form">
              <input name="application_type" type="hidden" value="new" />
              <input aria-hidden="true" autoComplete="off" className="form-honeypot" name="website" tabIndex={-1} />
              {jurisdiction && <input name="jurisdiction_code" type="hidden" value={jurisdiction.code} />}
              {defaultLicenseClass && <input name="license_class_code" type="hidden" value={defaultLicenseClass.code} />}
              <div className="application-form-heading">
                <p className="eyebrow">New license · 3 short steps</p>
                <h2>Tell us about your business.</h2>
                <p>A Company agent will read this and make the final decision.</p>
              </div>
              <section className="application-step">
                <div className="application-step-heading"><span>1</span><div><h3>Who are you?</h3><p>So staff know which business and Discord user to contact.</p></div></div>
                <div className="application-step-fields">
                  <label className="field">
                    <span>Business name</span>
                    <input autoComplete="organization" maxLength={200} name="applicant_name" placeholder="Example: Solitude Fine Tailoring" required />
                  </label>
                  <label className="field">
                    <span>Your Discord name</span>
                    <input autoComplete="username" maxLength={300} name="contact_label" placeholder="Example: aurelion" required />
                  </label>
                </div>
              </section>

              {ordinaryEndorsements && (
                <section className="application-step">
                  <div className="application-step-heading"><span>2</span><div><h3>What will you sell?</h3><p>Pick one or more. You can ask to change these later.</p></div></div>
                  <fieldset className="application-category-picker">
                    <legend className="sr-only">Goods the business will sell</legend>
                    <div>{ordinaryEndorsements.options.map((item) => (
                      <label key={item.code}>
                        <input name="endorsement_codes" type="checkbox" value={item.code} />
                        <span>{item.label}</span>
                      </label>
                    ))}</div>
                  </fieldset>
                </section>
              )}

              {specialEndorsements.length > 0 && (
                <details className="application-special-permissions">
                  <summary>Special permissions <small>Most businesses can skip this</small></summary>
                  <p>Open this only for bulk distribution, consignment, regulated goods, or individually tracked items.</p>
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

              <section className="application-step">
                <div className="application-step-heading"><span>3</span><div><h3>Describe the business</h3><p>One sentence is enough.</p></div></div>
                <label className="field application-purpose">
                  <span>What does the business do?</span>
                  <textarea maxLength={4000} minLength={10} name="statement" placeholder="Example: We make and sell clothing in Solitude." required rows={3} />
                </label>
              </section>
              {(!jurisdiction || !defaultLicenseClass) && <p className="staff-flash staff-flash-error" role="alert">New applications are temporarily paused because the standard license setup is incomplete.</p>}
              {state.error && <p className="staff-flash staff-flash-error" role="alert">{state.error}</p>}
              <button className="button button-primary application-submit" disabled={pending || !jurisdiction || !defaultLicenseClass}>{pending ? "Sending…" : "Send for review"}</button>
            </form>
          )}
        </section>
      )}

      <details className="application-status-check">
        <summary><strong>Already sent an application?</strong><span>Check its status</span></summary>
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
