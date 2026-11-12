#!/bin/zsh
# Genera cuadros sueltos para revisar el aspecto antes de renderizar.
mkdir -p out
foto() { npx remotion still src/index.ts "$1" "out/$3.png" --frame="$2" --image-format=png --log=error; }
foto arbol-crece 420 c420
foto arbol-crece 90 c090
foto arbol-crece 195 c195
foto arbol-viento 210 v210
foto saldo-86400 150 s150
echo CUADROS LISTOS
