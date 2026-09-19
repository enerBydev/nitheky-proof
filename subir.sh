#!/usr/bin/env bash
# nitheky-proof · subida del repo a GitHub en un comando.
#
# POR QUÉ ESTE SCRIPT EXISTE: el token con el que se trabajó la prueba es de
# SOLO LECTURA (verificado: ni crear repos ni push). Desde la máquina de
# Rene, con sus credenciales ya configuradas (`gh auth status` o ssh),
# esto crea el repo, sube todo y deja Pages a un clic.
#
# USO (desde la raíz del repo, ya autenticado en GitHub):
#   bash subir.sh
#
# Si prefiere la interfaz web: crear repo público "nitheky-proof" SIN README
# (vacío), copiar las líneas de git de abajo, y en Settings → Pages elegir
# "Deploy from a branch" → main / (root). La página queda en:
#   https://enerbydev.github.io/nitheky-proof/

set -euo pipefail

REPO="nitheky-proof"
USUARIO="enerBydev"

# 1 · el repo, público (si ya existe, este paso falla y se sigue adelante)
if command -v gh >/dev/null 2>&1; then
  gh repo create "$USUARIO/$REPO" --public \
    --description "NITHEKY same-direction matching — technical proof: route corridor, direction validation, atomic last-seat reservation. Reproducible." \
    2>/dev/null || echo "· el repo ya existe (se continúa)"
else
  echo "· 'gh' no está instalado: cree el repo vacío en github.com/new (público, SIN readme)"
  read -rp "  ¿Ya lo creó? [s/N] " ok; [ "${ok:-n}" = "s" ] || exit 1
fi

# 2 · el primer commit, si hace falta
git add -A
git diff --cached --quiet || git commit -m "feat: la prueba técnica completa — motor, SQL, tests, página"

# 3 · remote y push
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$USUARIO/$REPO.git"
git push -u origin main

# 4 · GitHub Pages, si está 'gh' (un solo comando más)
if command -v gh >/dev/null 2>&1; then
  gh api -X POST "repos/$USUARIO/$REPO/pages" \
    -f "source[branch]=main" -f "source[path]=/" 2>/dev/null \
    && echo "· Pages activado: https://$USUARIO.github.io/$REPO/" \
    || echo "· Pages: actívelo en Settings → Pages → main / root (dos clics)"
fi

echo
echo "Listo: https://github.com/$USUARIO/$REPO"
echo "Página: https://$USUARIO.github.io/$REPO/   (tarda ~1 min la primera vez)"
