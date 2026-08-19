export const metadata = {
  title: 'Offres',
  // Le job board est la SEULE vue destinée à être indexée.
  robots: { index: true, follow: true },
};

export default function Offres() {
  return (
    <main id="contenu" className="mx-auto max-w-5xl p-8">
      <h1 className="text-3xl font-semibold">Nos offres</h1>
      <p className="mt-2 text-sm text-[var(--pacha-ardoise)]">Job board public. À construire.</p>
    </main>
  );
}
