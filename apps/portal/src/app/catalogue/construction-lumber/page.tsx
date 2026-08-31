import { permanentRedirect } from "next/navigation";

export default function LegacyConstructionLumberPage() {
  permanentRedirect("/catalogue/firewood");
}
