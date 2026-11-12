#!/bin/zsh
# Renderiza los 5 clips en 4K, sus copias 1080p y las imagenes fijas de respaldo.
SAL=../deck/media
mkdir -p $SAL/4k $SAL/1080 $SAL/poster
inicio=$(date +%s)
clip() {
  npx remotion render src/index.ts "$1" "$SAL/4k/$1.mp4" --log=error || { echo "FALLO $1"; return 1; }
  npx remotion ffmpeg -hide_banner -loglevel error -y -i "$SAL/4k/$1.mp4" -vf "scale=$2:flags=lanczos" -c:v libx264 -crf 18 -preset medium -g 15 -keyint_min 15 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart -an "$SAL/1080/$1.mp4"
  npx remotion still src/index.ts "$1" "$SAL/poster/$1.jpg" --frame="$3" --image-format=jpeg --jpeg-quality=92 --log=error
  echo "LISTO $1 ($(( $(date +%s) - inicio )) s)"
}
clip arbol-crece 1080:1080 360
clip arbol-viento 1080:1080 0
clip arbol-respira 1080:1080 0
clip arbol-final 1080:1080 0
clip saldo-86400 1920:1080 30
du -sh $SAL/4k $SAL/1080 $SAL/poster
echo "RENDER TERMINADO en $(( $(date +%s) - inicio )) s"
