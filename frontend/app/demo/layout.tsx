/**
 * Les routes de démonstration sont PUBLIQUES mais ne doivent pas être indexées :
 * seul le Job Board a vocation à l'être. Une démonstration à données fictives
 * référencée par un moteur de recherche donnerait des résultats trompeurs.
 */
export const metadata = { robots: { index: false, follow: false } };

export default function LayoutDemo({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
