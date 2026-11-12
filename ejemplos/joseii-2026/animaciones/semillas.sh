#!/bin/zsh
# Compara semillas de arbol en baja resolucion.
mkdir -p out
for s in 23 5 11 37 71 101; do
  npx remotion still src/index.ts arbol-crece "out/sem$s.jpg" --frame=420 --scale=0.22 --image-format=jpeg --props="{\"modo\":\"crece\",\"semilla\":$s}" --log=error
done
echo SEMILLAS LISTAS
