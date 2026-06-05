# Mur Digital Interactif Intelligent - SOFTWELL

Application React + Vite pour capter des idees sur ecran tactile, les analyser par IA et les afficher en temps reel sur un mur digital.

## Lancer en local

```bash
npm install
npm run dev
```

Acces admin par defaut :

| Champ | Valeur |
| --- | --- |
| Identifiant | `admin` |
| Mot de passe | `admin123` |

Code d'activation participant par defaut : `2030`.

## IA

L'application n'utilise plus uniquement des donnees mockees. Elle tente une analyse IA reelle selon la configuration admin :

- `proxy` : appelle `/api/analyze`, prevu pour Vercel avec `OPENAI_API_KEY`.
- `direct` : appelle un endpoint OpenAI-compatible depuis le navigateur avec la cle saisie dans l'admin. A reserver a la demo locale, car la cle est visible cote client.
- `local` : analyse locale de secours, sans reseau.

Variables serveur recommandees sur Vercel :

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_BASE_URL=https://api.openai.com/v1
```

Sans cle serveur ou endpoint configure, l'app continue de fonctionner avec un fallback local et l'indique dans la contribution.

## Vues principales

- Mur digital : mosaiche, spotlight ou flux, reactions live et bandeau de tendances.
- Saisie tactile : code numerique d'activation, categories XXL, analyse IA, visuel genere.
- Admin : dashboard, analyse IA, moderation, gestion des contenus, statistiques et configuration dark/light.

## Build

```bash
npm run build
```
