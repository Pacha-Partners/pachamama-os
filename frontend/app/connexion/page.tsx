export const metadata = { title: 'Connexion' };

export default function Connexion() {
  return (
    <main id="contenu" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--pacha-violet)]">
        Pachamama OS
      </p>
      <h1 className="mt-2 text-4xl font-semibold">Connexion</h1>
      <p className="mt-2 text-sm text-[var(--pacha-ardoise)]">
        Authentification à brancher sur le fournisseur d’identité.
      </p>
    </main>
  );
}
