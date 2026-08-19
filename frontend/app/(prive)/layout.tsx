import { redirect } from 'next/navigation';
import { utilisateurCourant } from '@/lib/session';

/**
 * Layout des vues authentifiées.
 *
 * Le garde-fou ici évite d'afficher une coquille vide à un visiteur non
 * connecté. Il ne remplace PAS l'autorisation : celle-ci vit dans les policies
 * PostgreSQL. Un contrôle en bordure protège l'expérience, la RLS protège la
 * donnée.
 *
 * Il passe par `utilisateurCourant()` et non par le client Supabase directement.
 * La raison est concrète : construire le client lève quand l'environnement n'est
 * pas configuré, ce qui renvoyait un 500 sur `/talent`, `/entreprise` et
 * `/recruteur` au lieu de la redirection attendue. Un environnement sans
 * authentification n'est pas une panne : c'est un visiteur non identifié, et le
 * sens sûr de la défaillance est de le renvoyer vers la connexion.
 */
export default async function LayoutPrive({ children }: { children: React.ReactNode }) {
  const utilisateur = await utilisateurCourant();
  if (!utilisateur) redirect('/');
  return <>{children}</>;
}
