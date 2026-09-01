"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutDealerAction } from "@/app/dealer/actions";
import { EecLogo } from "@/components/eec-logo";
import { UiIcon } from "@/components/ui-icon";

const items = [
  ["/dealer", "Home", "dashboard"],
  ["/dealer/orders/new", "Start an order", "catalogue"],
  ["/dealer/orders", "My orders", "clipboard"],
] as const;

export function DealerShell({ children, institutionName }: { children: React.ReactNode; institutionName: string }) {
  const pathname = usePathname();
  if (pathname === "/dealer/login") return <>{children}</>;
  return <div className="dealer-app-shell"><header className="dealer-app-header"><Link className="app-brand" href="/dealer"><span className="app-brand-mark"><EecLogo priority sizes="52px" /></span><span><strong>{institutionName}</strong><small>Business account</small></span></Link><nav aria-label="Business portal navigation">{items.map(([href,label,icon])=><Link className={pathname === href || (href !== "/dealer" && pathname.startsWith(`${href}/`)) ? "is-active" : ""} href={href} key={href}><UiIcon name={icon}/>{label}</Link>)}</nav><div className="dealer-account-actions"><Link href="/" target="_blank"><UiIcon name="external"/>Public shop</Link><form action={signOutDealerAction}><button type="submit"><UiIcon name="logout"/>Sign out</button></form></div></header>{children}</div>;
}
