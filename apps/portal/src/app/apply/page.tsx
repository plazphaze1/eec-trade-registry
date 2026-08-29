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
          <p className="eyebrow">Business licensing · about 2 minutes</p>
          <h1>Let&apos;s get your business licensed.</h1>
          <p>
            Answer a few simple questions. You do not need an account or email,
            and nothing is approved automatically.
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
