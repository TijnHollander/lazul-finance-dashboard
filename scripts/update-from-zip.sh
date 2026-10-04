#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Chimera / Lazul Finance: update vanuit een zip
#
#  Gebruik (in de projectmap, bijv. de terminal in VS Code):
#     npm run update                 → pakt de nieuwste zip uit ~/Downloads
#     npm run update -- pad/naar.zip → een specifieke zip
#     npm run update -- --push       → daarna ook meteen committen en pushen
#
#  Wat er gebeurt:
#   1. de nieuwste chimera-finance*.zip / lazul-finance*.zip in Downloads zoeken
#   2. uitpakken naar een tijdelijke map
#   3. bestanden over je project heen kopiëren; .git, node_modules, build en .env blijven staan
#   4. npm install als de dependencies zijn veranderd
#   5. laten zien wat er is gewijzigd en (op verzoek) committen + pushen naar GitHub
#      → Vercel en GitHub Pages zetten de nieuwe versie daarna vanzelf live
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT="$(pwd)"
ZIP=""
PUSH="vraag"
for arg in "$@"; do
	case "$arg" in
		--push) PUSH="ja" ;;
		--no-push) PUSH="nee" ;;
		*) ZIP="$arg" ;;
	esac
done

groen() { printf "\033[32m%s\033[0m\n" "$1"; }
paars() { printf "\033[35m%s\033[0m\n" "$1"; }
fout() { printf "\033[31m%s\033[0m\n" "$1" >&2; exit 1; }

# ── controle: zitten we in de juiste map?
[ -f "$PROJECT/package.json" ] || fout "Geen package.json gevonden. Open eerst je projectmap (cd naar de map) en probeer opnieuw."
grep -qE '"name": *"(chimera-finance|lazul-finance[a-z-]*)"' "$PROJECT/package.json" || fout "Dit lijkt niet het Chimera/Lazul-project te zijn ($PROJECT). Gestopt voor de zekerheid."

# ── zip zoeken
if [ -z "$ZIP" ]; then
	ZIP="$(ls -t "$HOME"/Downloads/chimera-finance*.zip "$HOME"/Downloads/lazul-finance*.zip 2>/dev/null | head -n 1 || true)"
fi
[ -n "$ZIP" ] && [ -f "$ZIP" ] || fout "Geen zip gevonden. Zet de zip in je Downloads-map of geef het pad mee: npm run update -- ~/pad/naar/bestand.zip"
paars "▸ Zip: $ZIP"

# ── uitpakken
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
if command -v ditto >/dev/null 2>&1; then ditto -x -k "$ZIP" "$TMP"; else unzip -q "$ZIP" -d "$TMP"; fi
rm -rf "$TMP/__MACOSX"
SRC="$(dirname "$(find "$TMP" -maxdepth 3 -name package.json -not -path '*/node_modules/*' | awk '{ print length, $0 }' | sort -n | head -n 1 | cut -d' ' -f2-)")"
[ -f "$SRC/package.json" ] || fout "In de zip zit geen project (package.json ontbreekt)."

# ── dependencies vergelijken vóór het kopiëren
hash_deps() { cat "$1/package.json" "$1/package-lock.json" 2>/dev/null | shasum | cut -d' ' -f1; }
VOOR="$(hash_deps "$PROJECT")"

# ── kopiëren (bestaande bestanden worden overschreven, eigen extra bestanden blijven staan)
EXCLUDES=(.git node_modules .svelte-kit build .vercel .env '.env.*' .DS_Store)
if command -v rsync >/dev/null 2>&1; then
	rsync -a $(printf -- "--exclude=%s " "${EXCLUDES[@]}") "$SRC"/ "$PROJECT"/
else
	(cd "$SRC" && tar $(printf -- "--exclude=./%s " "${EXCLUDES[@]}") -cf - .) | (cd "$PROJECT" && tar -xf -)
fi
groen "✓ Bestanden bijgewerkt"

if [ "$VOOR" != "$(hash_deps "$PROJECT")" ] || [ ! -d "$PROJECT/node_modules" ]; then
	paars "▸ Dependencies gewijzigd: npm install…"
	npm install --no-audit --no-fund
	groen "✓ npm install klaar"
fi

# ── git: wijzigingen tonen en eventueel pushen
if [ -d "$PROJECT/.git" ]; then
	echo
	paars "▸ Gewijzigde bestanden:"
	git -C "$PROJECT" status --short
	if [ -z "$(git -C "$PROJECT" status --porcelain)" ]; then
		groen "✓ Niets veranderd: je had deze versie al."
		exit 0
	fi
	if [ "$PUSH" = "vraag" ]; then
		echo
		read -r -p "Committen en pushen naar GitHub (zet de site live)? [j/N] " antwoord
		[[ "$antwoord" =~ ^[jJyY] ]] && PUSH="ja" || PUSH="nee"
	fi
	if [ "$PUSH" = "ja" ] && [ -z "$(git -C "$PROJECT" config user.email || true)" ]; then
		echo "Git weet nog niet wie je bent. Eenmalig instellen en daarna opnieuw npm run update:"
		echo "  git config --global user.name \"Jouw Naam\""
		echo "  git config --global user.email \"jij@voorbeeld.nl\""
		exit 1
	fi
	if [ "$PUSH" = "ja" ]; then
		git -C "$PROJECT" add -A
		git -C "$PROJECT" commit -q -m "Update vanuit $(basename "$ZIP")"
		git -C "$PROJECT" push
		groen "✓ Gepusht. Vercel/GitHub Pages bouwt de nieuwe versie nu."
	else
		echo "Niet gepusht. Later: git add -A && git commit -m \"update\" && git push"
	fi
else
	echo "(Geen git-repo in deze map; alleen de bestanden zijn bijgewerkt.)"
fi

echo
groen "Klaar! Start lokaal met: npm run dev"
