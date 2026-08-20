export default function Home() {
  return (
    <main className="max-w-content mx-auto p-6 space-y-6">
      <header className="border-b border-border pb-4">
        <h1 className="text-[32px] leading-[38px] font-semibold text-text">
          CropRoute
        </h1>
        <p className="text-sm leading-5 text-text-muted mt-1">
          Wholesale food price and sourcing intelligence for India
        </p>
      </header>

      <section className="bg-surface border border-border rounded-card shadow-card p-6 space-y-4">
        <h2 className="text-xl leading-6 font-semibold text-text">
          Frontend Scaffold Active
        </h2>
        <p className="text-sm leading-5 text-text-muted">
          Next.js App Router skeleton with TypeScript and Tailwind CSS design tokens active.
        </p>

        <div className="flex flex-wrap gap-4 pt-2">
          <div className="bg-brand-soft border border-brand/20 text-brand px-3 py-1.5 rounded-pill text-xs font-medium">
            Brand Token (#2E7D4F)
          </div>
          <div className="bg-accent-soft border border-accent/20 text-accent px-3 py-1.5 rounded-pill text-xs font-medium">
            Accent Token (#C77D0A)
          </div>
          <div className="bg-surface-2 border border-border px-3 py-1.5 rounded-pill text-xs text-text-muted tabular-nums">
            Tabular Nums: ₹2,450 / qtl
          </div>
        </div>
      </section>
    </main>
  );
}
