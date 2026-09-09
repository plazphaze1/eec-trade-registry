import type { Metadata } from "next";

import { StaffShell } from "@/components/staff-shell";
import { getInstitutionName } from "@/lib/env";
import { getMyStaffAccessState } from "@/lib/staff-access";
import { getOptionalStaffSession } from "@/lib/staff-auth";

export const metadata: Metadata = {
  title: "Staff console",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const { client, subject } = await getOptionalStaffSession();
  let accessClass: "owner" | "agent" | null = null;
  let displayName: string | null = null;
  if (subject) {
    const access = await getMyStaffAccessState(client);
    if (access.ok && access.data.state === "authorized") {
      accessClass = access.data.access_class;
      displayName = access.data.display_name;
    }
  }
  return <StaffShell accessClass={accessClass} displayName={displayName} institutionName={getInstitutionName()}>{children}</StaffShell>;
}
