# kaWhat

Kahoot-inspirert quiz-app med sanntids flerspiller. En host presenterer spørsmål, og deltakere svarer fra sine egne enheter.

## Funksjoner

- **Sanntids quiz** — Host viser spørsmål, deltakere svarer fra mobil/PC via WebSocket
- **QR-kode + PIN** — Deltakere scanner QR-kode eller taster inn 6-sifret PIN for å bli med
- **Kallenavn** — Deltakere velger eget kallenavn, ingen innlogging nødvendig for å spille
- **Poengberegning** — Poeng basert på riktig svar, svarhastighet og streak-bonus
- **Leaderboard** — Poengtavle mellom spørsmål og ved spillslutt
- **Quiz-bibliotek** — Lagre quizzer og spill dem flere ganger
- **Google-innlogging** — Logg inn med Google for å opprette og administrere quizzer
- **Docker-klar** — Dockerfile for enkel deploy til Railway eller andre plattformer

## Tech Stack

- **Next.js 14** (App Router) — Fullstack React
- **Socket.io** — Sanntidskommunikasjon
- **TailwindCSS** — Styling
- **NextAuth.js** — Google OAuth-innlogging
- **qrcode.react** — QR-kode-generering

## Kom i gang

### Forutsetninger

- Node.js 18+
- Google OAuth credentials ([console.cloud.google.com](https://console.cloud.google.com/apis/credentials))

### Installasjon

```bash
git clone https://github.com/stianfs/kaWhat.git
cd kaWhat
npm install
```

### Miljøvariabler

Kopier `.env.example` til `.env.local` og fyll inn verdiene:

```bash
cp .env.example .env.local
```

| Variabel | Beskrivelse |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth Client ID fra Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth Client Secret |
| `NEXTAUTH_SECRET` | Tilfeldig streng (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | App-URL, f.eks. `http://localhost:3000` |

I Google Cloud Console, legg til denne som **Authorized redirect URI**:
```
http://localhost:3000/api/auth/callback/google
```

### Kjør lokalt

```bash
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000).

## Deploy med Docker (Railway)

```bash
docker build -t kawhat .
docker run -p 3000:3000 \
  -e GOOGLE_CLIENT_ID=... \
  -e GOOGLE_CLIENT_SECRET=... \
  -e NEXTAUTH_SECRET=... \
  -e NEXTAUTH_URL=https://din-url.up.railway.app \
  kawhat
```

### Railway-oppsett

1. Opprett nytt prosjekt i Railway og koble til dette repoet
2. Sett miljøvariabler i Railway dashboard (se tabellen over)
3. Oppdater `NEXTAUTH_URL` til Railway-URLen
4. Legg til Railway-URL som redirect URI i Google Cloud Console:
   `https://din-url.up.railway.app/api/auth/callback/google`

## Bruk

### Host (quiz-eier)
1. Logg inn med Google
2. Opprett en quiz med spørsmål og svaralternativer
3. Lagre quizzen eller start direkte
4. Del PIN/QR-kode med deltakere
5. Start spillet og naviger gjennom spørsmål

### Deltaker
1. Gå til forsiden og skriv inn Game PIN (eller skann QR)
2. Velg et kallenavn
3. Svar på spørsmål innen tidsfristen
4. Se resultater og leaderboard
