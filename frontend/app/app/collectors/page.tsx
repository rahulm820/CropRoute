import type { Metadata } from "next";
import SelfHealPanel from "@/components/SelfHealPanel";

export const metadata: Metadata = {
  title: "Collectors — CropRoute",
  description:
    "Self-healing collector status: monitor field completeness, view transition history, and verify scraper reliability in real time.",
};

/**
 * /collectors — Self-heal panel.
 *
 * The reliability artifact. Shows every collector's live status,
 * field completeness, and run transition history. Must be readable
 * on a projector from three metres. See docs/SELF-HEAL.md.
 */
export default function CollectorsPage() {
  return (
    <main className="max-w-content mx-auto p-6 space-y-6">
      <header className="border-b border-border pb-4">
        <h1 className="text-[32px] leading-[38px] font-semibold text-text">
          Collectors
        </h1>
        <p className="text-[14px] leading-[20px] text-text-muted mt-1">
          Self-healing scraper status — field completeness and transition
          history
        </p>
      </header>

      <SelfHealPanel />
    </main>
  );
}
