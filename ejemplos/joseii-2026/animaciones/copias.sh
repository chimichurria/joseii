#!/bin/zsh
# Copias 1080p para pantallas que no son 4K.
SAL=../deck/media
copia() {
  npx remotion ffmpeg -hide_banner -loglevel error -y -i "$SAL/4k/${1}.mp4" -vf "scale=${2}:flags=lanczos" -c:v libx264 -crf 18 -preset medium -g 15 -keyint_min 15 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart -an "$SAL/1080/${1}.mp4" && echo "COPIA ${1}"
}
copia arbol-crece 1080:1080
copia arbol-viento 1080:1080
copia arbol-respira 1080:1080
copia arbol-final 1080:1080
copia saldo-86400 1920:1080
du -sh $SAL/4k $SAL/1080 $SAL/poster
echo COPIAS TERMINADAS
