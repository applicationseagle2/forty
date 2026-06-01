import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-6 md:px-12 py-8 flex justify-between items-center">
        <div className="font-display text-xl tracking-tightest">Forty</div>
        <Link href="/admin" className="btn-ghost text-sm">Admin sign in →</Link>
      </header>

      <section className="flex-1 px-6 md:px-12 grid md:grid-cols-12 gap-8 items-center max-w-7xl mx-auto w-full">
        <div className="md:col-span-7 py-16 md:py-24">
          <p className="display-eyebrow mb-8">A congregational fast</p>
          <h1 className="display-h1 mb-8">
            Forty days.<br />
            One unbroken
            <span className="italic font-normal text-sage-700"> chain.</span>
          </h1>
          <p className="text-lg text-ink-700 max-w-xl leading-relaxed mb-10">
            A quiet tool for organizing a congregational fast where each family carries
            one day, and the prayer passes from hand to hand for forty.
          </p>
          <div className="flex gap-4">
            <Link href="/admin" className="btn-primary">Admin sign in</Link>
          </div>
        </div>

        <div className="md:col-span-5 py-8 md:py-24">
          <div className="card p-8">
            <p className="display-eyebrow mb-4">The pattern</p>
            <ol className="space-y-3 text-ink-700">
              <li className="flex gap-3"><span className="font-display text-sage-700 w-6">1</span>A Ward Admin creates a fast with a purpose and a start date.</li>
              <li className="flex gap-3"><span className="font-display text-sage-700 w-6">2</span>A link is shared with the ward by email or text.</li>
              <li className="flex gap-3"><span className="font-display text-sage-700 w-6">3</span>Families pick a day and commit to 24 hours of fasting.</li>
              <li className="flex gap-3"><span className="font-display text-sage-700 w-6">4</span>Each participant receives reminders, then is invited to share what they experienced.</li>
            </ol>
          </div>
        </div>
      </section>

      <footer className="px-6 md:px-12 py-8 text-xs text-ink-500 border-t border-parchment-200 mt-12">
        Forty — quiet by design
      </footer>
    </main>
  );
}
