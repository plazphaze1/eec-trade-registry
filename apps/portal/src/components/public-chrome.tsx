"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { EecSeal } from "@/components/eec-seal";
import { UiIcon } from "@/components/ui-icon";

const links = [
  ["/", "Shop"],
  ["/how-it-works", "How it works"],
  ["/verify", "Check a license"],
  ["/apply", "Get a trade license"],
] as const;

export function PublicHeader({ institutionName }: { institutionName: string }) {
  const pathname = usePathname();
  if (pathname.startsWith("/staff") || pathname.startsWith("/dealer")) return null;
  return <header className="site-header"><div className="site-header-inner">
    <Link className="brand" href="/" aria-label={`${institutionName} home`}><span className="brand-mark" aria-hidden="true"><EecSeal /></span><span><strong>{institutionName}</strong><small>Trade &amp; supply</small></span></Link>
    <nav className="public-desktop-nav" aria-label="Primary navigation">{links.map(([href,label])=><Link className={pathname === href || (href !== "/" && pathname.startsWith(href)) ? "is-active" : ""} href={href} key={href}>{label}</Link>)}<Link className="public-login-link" href="/dealer/login">Business portal</Link><Link className="button button-primary button-compact" href="/staff/login">Staff sign in</Link></nav>
    <details className="public-mobile-nav"><summary aria-label="Open navigation"><UiIcon name="menu"/><span>Menu</span></summary><nav aria-label="Mobile navigation">{links.map(([href,label])=><Link href={href} key={href}>{label}</Link>)}<Link href="/dealer/login">Business portal</Link><Link href="/staff/login">Staff sign in</Link></nav></details>
  </div></header>;
}

export function PublicFooter({ institutionName }: { institutionName: string }) {
  const pathname = usePathname();
  if (pathname.startsWith("/staff") || pathname.startsWith("/dealer")) return null;
  return <footer className="site-footer"><EecSeal className="footer-seal"/><div><strong>{institutionName}</strong><p>Goods, business licensing, and official verification in one place.</p><Link href="/how-it-works">How the system works</Link></div><p>Catalogue information comes directly from the Company registry. Final price and availability are confirmed when an order is placed.</p></footer>;
}
