'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * Fournisseur TanStack Query.
 *
 * Le client est créé dans un `useState` et non au niveau du module : sur le
 * serveur, un client partagé entre deux requêtes ferait fuiter le cache d'un
 * utilisateur vers un autre.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Les données de sourcing bougent : on ne les garde pas fraîches
            // longtemps, mais on évite de refetcher à chaque focus de fenêtre.
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
