/**
 * Lecture d'un fichier JSONL, ligne par ligne.
 *
 * POURQUOI NE PAS UTILISER readline
 * Le `readline` de Node considère U+2028 (LINE SEPARATOR) et U+2029
 * (PARAGRAPH SEPARATOR) comme des fins de ligne. Or `json.dumps` en
 * Python ne les échappe pas — ils sont légalement autorisés dans une
 * chaîne JSON — et l'itération de fichier de Python ne les traite pas
 * comme des séparateurs. Un fichier parfaitement valide côté producteur
 * se retrouve donc coupé au milieu d'une chaîne côté Node.
 *
 * Le pivot en contient 21 occurrences, dans des descriptions rédigées par
 * des talents. On corrige donc le LECTEUR, jamais la donnée : ces
 * caractères sont du contenu.
 *
 * Ce découpage ne reconnaît que le saut de ligne (\n), en flux, pour ne
 * pas charger en mémoire un fichier qui grossira.
 */
import { createReadStream } from 'node:fs';

export async function* lignesJsonl(chemin) {
  const flux = createReadStream(chemin, { encoding: 'utf8', highWaterMark: 1 << 20 });
  let reste = '';
  let numero = 0;
  for await (const morceau of flux) {
    const parties = (reste + morceau).split('\n');
    reste = parties.pop() ?? '';            // la dernière partie peut être incomplète
    for (const p of parties) {
      numero++;
      if (p.trim()) yield { numero, texte: p };
    }
  }
  if (reste.trim()) yield { numero: numero + 1, texte: reste };
}
