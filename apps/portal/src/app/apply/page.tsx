import type { Metadata } from "next";

import { ApplicationForms } from "@/app/apply/application-forms";
import { EecHeroEmblem } from "@/components/eec-logo";
import { getApplicationOptions } from "@/lib/license-application";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Apply for a business license",
  description: "Apply for configured East Empire Company business trade authority.",
};

export default async function ApplyPage() {
  const options = await getApplicationOptions(await createServerSupabaseClient());
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
        <EecHeroEmblem />
      </section>
      {options ? (
        <ApplicationForms options={options} />
      ) : (
        <section className="notice-panel">
          <h2>Applications are temporarily unavailable</h2>
          <p>We could not load the application form. Please try again in a few minutes.</p>
        </section>
      )}
    </main>
  );
}
