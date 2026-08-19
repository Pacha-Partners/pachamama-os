import { redirect } from 'next/navigation';
import { clientServeur } from '@/lib/supabase/serveur';

/**
 * Layout des vues authentifiées.
 *
 * Le garde-fou ici évite d'afficher une coquille vide à un visiteur non
 * connecté. Il ne remplace PAS l'autorisation : celle-ci vit dans les policies
 * PostgreSQL. Un contrôle en bordure protège l'expérience, la RLS protège la
 * donnée.
 */
export default async function LayoutPrive({ children }: { children: React.ReactNode }) {
  const supabase = await clientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');
  return <>{children}</>;
}
