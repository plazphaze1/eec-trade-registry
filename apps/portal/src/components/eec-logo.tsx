import Image from "next/image";

interface EecLogoProps {
  className?: string;
  priority?: boolean;
  sizes?: string;
}

export function EecLogo({
  className,
  priority = false,
  sizes = "220px",
}: EecLogoProps) {
  return (
    <Image
      alt=""
      className={className ? `eec-logo ${className}` : "eec-logo"}
      height={500}
      priority={priority}
      sizes={sizes}
      src="/brand/eec-warehouse-logo.png"
      width={507}
    />
  );
}

export function EecHeroEmblem() {
  return (
    <aside className="eec-hero-emblem" aria-hidden="true">
      <span className="eec-emblem-kicker">Official company registry</span>
      <EecLogo className="eec-emblem-logo" priority sizes="220px" />
      <span className="eec-emblem-rule"><i /><b>◆</b><i /></span>
      <span className="eec-emblem-motto">Trade · Supply · Authority</span>
    </aside>
  );
}
