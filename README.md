# Lazul Finance: persoonlijk financieel dashboard

Een privacyvriendelijk financieel dashboard voor Nederland. Er is geen database en geen account: alles staat in de `localStorage` van je eigen browser.

- **Portfolio**: importeer CSV-exports van Trading 212, DEGIRO, Trade Republic (via pytr / Portfolio Performance), ING Zelf Beleggen of een ander bestand (kolommen zelf koppelen). Je ziet posities, verdeling, resultaat, dividend en live koersen.
- **Uitgaven & inkomsten**: importeer bankafschriften van ING, Rabobank, ABN AMRO, bunq, Revolut en andere banken. Transacties worden automatisch gecategoriseerd. Per maand zie je het gemiddelde, het **gewogen gemiddelde** (recente maanden tellen zwaarder) en de mediaan. Overboekingen naar je eigen spaar- of beleggingsrekening tellen niet als uitgave.
- **Rapport**: het algemene rapport uit Lazul Finance, uitgebreid. Het geeft een score, een buffer-indicatie, een maandplan voor sparen en beleggen, tips met bronnen en een selectie ETF's. Daarnaast is er een **grafiek die je vermogen vergelijkt met leeftijdsgenoten** op basis van CBS-cijfers (gemiddelde en mediaan per leeftijdsgroep, met een geschatte percentielpositie), plus een projectie met een schuifje "wat als ik € X extra beleg?".
- **Markt**: een volglijst met koersen en grafieken (1D t/m 5J). Dezelfde lijst loopt als tickerband bovenin de app. Klik op een aandeel en onder de grafiek staat een **analyse** met:
  - analistenrating (% kopen/houden/verkopen) en koersdoel
  - K/W-verhouding (nu en verwacht), PEG en beurswaarde
  - of de omzet elke 1–2 jaar verdubbelt
  - of de EPS stijgt, en zo niet, de waarschijnlijke oorzaken (marges, verwatering, R&D, eenmalige posten)
  - indicatoren voor een competitief voordeel (moat) en het verdienmodel
  - een 10x-berekening met eigen aannames
  - je eigen oordeel als notitie
- **Automatisch verversen**: koersen elke 60 seconden (120 met Finnhub) zolang het tabblad open staat; nieuws elke 5 minuten.
- **Nieuws**: NOS Economie, CNBC en Yahoo Finance, met de filters "Belangrijk" (macro en jouw posities), "Mijn portfolio" en "Nederlands".
- **Inloggen**: lokaal profiel met optionele pincode, in de huisstijl van het Finance Dashboard-loginscherm.

## Techniek

- **SvelteKit 2 + Svelte 5 + TypeScript + Tailwind 4**, gebouwd met `adapter-static`: de hele app is statische HTML/JS.
- **Chart.js** voor de grafieken en **PapaParse** voor CSV.
- `api/*.js`: kleine serverless-functies voor Vercel die koersen (Yahoo Finance), zoekresultaten (ISIN naar ticker), bedrijfscijfers voor de analyse en RSS-nieuws ophalen. Daar is geen API-sleutel voor nodig. Tijdens `npm run dev` draaien deze functies ook lokaal.
- Wisselkoersen komen van Frankfurter (ECB-koersen, gratis).

## Lokaal draaien

```bash
npm install
npm run dev        # http://localhost:5173
```

Voorbeeldbestanden om mee te testen staan in `static/voorbeelden/`.

## Updaten vanuit een nieuwe zip (Mac)

Krijg je een nieuwe versie als zip, laat die dan in je Downloads-map staan en voer in de projectmap uit:

```bash
npm run update            # nieuwste chimera-finance*.zip uit Downloads
npm run update -- --push  # en meteen committen + pushen (site gaat live)
```

Het script pakt de zip uit en overschrijft de projectbestanden. `.git`, `node_modules`, `build` en `.env` worden niet aangeraakt. Als de dependencies zijn veranderd, draait het `npm install`. Daarna zie je wat er gewijzigd is en kun je kiezen of je wilt pushen.

## Hosten

### Vercel (aanbevolen: koersen en nieuws werken zonder sleutel)
1. Zet de repo op GitHub en importeer hem in Vercel.
2. Vercel leest `vercel.json`: build `npm run build`, output `build/`, functies uit `api/`.
3. Klaar. Er zijn geen environment variables nodig.

### GitHub Pages (volledig statisch)
1. Repo → Settings → Pages → Source: **GitHub Actions**.
2. Push naar `main`. De workflow `.github/workflows/deploy-pages.yml` bouwt met `BASE_PATH=/<repo-naam>`.
3. GitHub Pages kan geen serverfuncties draaien. Vul daarom in de app bij **Instellingen** een gratis [Finnhub](https://finnhub.io/register)-sleutel in voor koersen en nieuws. Let op: het gratis Finnhub-abonnement dekt vooral Amerikaanse aandelen en heeft geen grafiekdata.

## Data & privacy
- Alle data staat in `localStorage` onder de sleutels `lazul:*`. Via Instellingen kun je een back-up maken (JSON), die terugzetten of alles wissen.
- De pincode wordt als SHA-256-hash bewaard. Dat schermt je dashboard af op een gedeeld apparaat, maar het is geen versleuteling.

## Bronnen
- CBS StatLine 83834NED: *Vermogen van huishoudens; huishoudenskenmerken, vermogensbestanddelen*, peildatum 1 januari 2024 (voorlopig). De cijfers staan in `src/lib/report.ts` en zijn makkelijk bij te werken als CBS in het najaar van 2026 nieuwe cijfers publiceert.
- Nibud: financiële buffer. AFM: Is beleggen iets voor jou? Belastingdienst: box 3, heffingsvrij vermogen 2026 € 59.357. DUO: studieschuld. S&P SPIVA: actief versus passief beleggen.

## Projectstructuur
```
api/                    Vercel-functies (quote, search, analysis, news, health)
src/lib/parsers/        CSV-lezer, broker- en bankparsers
src/lib/cashflow.ts     categorisering + (gewogen) gemiddelden
src/lib/report.ts       rapportlogica, CBS-data, projectie, ETF's
src/lib/market.ts       koers-/nieuwslaag (Vercel-API of Finnhub)
src/lib/live.ts         automatisch verversen (koersen 60 s, nieuws 5 min)
src/lib/analysis.ts     aandelenanalyse: groei, EPS, moat, 10x-som
scripts/                update-from-zip.sh (npm run update)
src/lib/portfolio.ts    waardering van posities
src/routes/             pagina's: login, overzicht, portfolio, uitgaven, rapport, markt, nieuws, instellingen
```

*Educatief hulpmiddel, geen financieel advies.*
