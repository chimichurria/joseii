#!/bin/zsh
# Saca cuadros repartidos de los cinco clips para revisarlos.
mkdir -p out/rev
foto() { npx remotion ffmpeg -hide_banner -loglevel error -y -ss "$2" -i "../deck/media/1080/$1.mp4" -frames:v 1 "out/rev/$1-$2.jpg"; }
foto arbol-crece 2; foto arbol-crece 6; foto arbol-crece 10; foto arbol-crece 15
foto arbol-viento 4; foto arbol-viento 7.5; foto arbol-viento 11
foto arbol-respira 5; foto arbol-final 2; foto arbol-final 7
foto saldo-86400 7; foto saldo-86400 7.8; foto saldo-86400 9.5
