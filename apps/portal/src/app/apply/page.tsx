import type { Metadata } from "next";

import { ApplicationForms } from "@/app/apply/application-forms";
import { getApplicationOptions } from "@/lib/license-application";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Apply or renew",
  description: "Apply for configured East Empire Company trade authority or request renewal of an existing license.",
};

interface ApplyPageProps {
  searchParams: Promise<{ task?: string }>;
}

export default async function ApplyPage({ searchParams }: ApplyPageProps) {
  const [{ task }, options] = await Promise.all([
    searchParams,
    getApplicationOptions(await createServerSupabaseClient()),
  ]);
  const mode = task === "renew" ? "renewal" : "new";
  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">Business licensing</p>
          <h1>Get or renew a trade license</h1>
          <p>
            Choose what you need and answer a few short questions. No login or
            email is required.
          </p>
        </div>
      </section>
      {options ? (
        <ApplicationForms key={mode} mode={mode} options={options} />
      ) : (
        <section className="notice-panel">
          <h2>Applications are temporarily unavailable</h2>
          <p>No fallback form is used while the authoritative registry is unavailable.</p>
        </section>
      )}
    </main>
  );
}
