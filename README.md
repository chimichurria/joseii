# joseii · Tu PowerPoint, convertido en una charla en vivo

Agarrá tu `.pptx` y obtené **un solo archivo HTML** con el estilo de la charla de [JoSEII Rosario 2026](ejemplos/joseii-2026/): títulos que entran palabra por palabra, puntos que aparecen de a uno, fondo animado, notas del orador y reloj.

Si querés, sumás el **modo en vivo, tipo Menti**: la sala escanea un QR y vota, arma una nube de palabras y manda preguntas desde el celular. Vos manejás todo desde tu teléfono.

- **Sin instalar nada.** El conversor es una página web que corre en tu navegador. Tu archivo no se sube a ningún lado.
- **Sin internet para presentar.** El HTML lleva las imágenes adentro y se abre con doble clic.
- **El modo en vivo es opcional.** Sin servidor, las votaciones se cuentan a mano con + y −. Con servidor (gratis en Vercel), la sala vota desde el celular.

## Empezar en 1 minuto

**👉 [Abrí el conversor](https://chimichurria.github.io/joseii/)**

1. Arrastrá tu `.pptx`.
2. Elegí las opciones.
3. Tocá **Descargar HTML**.

Funciona también sin internet: descargá [`index.html`](index.html) (botón **Download raw file** en GitHub) y abrilo en Chrome, Edge, Firefox o Safari.

Para probar sin un PowerPoint propio, usá [`ejemplos/demo.pptx`](ejemplos/demo.pptx). Así queda convertido: [mirá la demo](https://chimichurria.github.io/joseii/ejemplos/demo.html).

### Al presentar

| Tecla | Qué hace |
|---|---|
| `→` `espacio` `Enter` | Avanza (o muestra el punto siguiente) |
| `←` | Vuelve |
| `F` | Pantalla completa |
| `N` | Notas del orador, reloj y qué diapositiva sigue |
| `G` | Ir a cualquier diapositiva (también tocando el número de abajo) |
| `B` | Pantalla en blanco |
| `C` | Conexión del modo en vivo |
| `T` | Reinicia el reloj |

También se avanza con clic o deslizando el dedo en una tableta. Para guardarla como **PDF**: imprimir desde el navegador → *Guardar como PDF* (una diapositiva por página).

## Cómo arma cada diapositiva

No hace falta preparar nada especial: el conversor mira cada diapositiva y elige el diseño.

| En tu PowerPoint | En el HTML |
|---|---|
| La primera diapositiva | Portada con el título grande |
| Diapositiva de encabezado de sección, o solo con título | Separador numerado (01, 02…) |
| 2 a 4 puntos, cada uno con sub-puntos | Tarjetas, una por clic |
| 2 o 3 frases cortas | Tarjetas numeradas |
| Hasta 6 puntos | Filas numeradas, una por clic |
| Muchos puntos | Lista |
| Un número solo (`10`, `85%`, `USD 1.200`) | Número gigante que cuenta hasta su valor |
| Un texto entre comillas y su autor | Cita grande |
| Tabla | Tabla |
| Texto con imagen | Texto a la izquierda, imagen a la derecha |
| Notas del orador | Notas (tecla `N` y en el control del celular) |

**La parte destacada del título** (en degradé) es lo que pusiste en **negrita** en el título del PowerPoint. Si no hay negrita, se destaca el final de la frase.

Si una diapositiva tiene demasiado texto, se achica sola hasta que entre.

## Modo en vivo

Activá **Modo en vivo, tipo Menti** en el conversor (o `--vivo` en la terminal) y marcá tus diapositivas desde el PowerPoint:

| Para… | Título de la diapositiva | Contenido |
|---|---|---|
| Una votación | `VOTAR: ¿tu pregunta?` | Cada opción, una viñeta (hasta 10) |
| Una nube de palabras | `NUBE: ¿tu pregunta?` | Opcional: una línea de ayuda |
| Preguntas de la sala | `¿Preguntas?` | — |

El prefijo `VOTAR:` o `NUBE:` no aparece en pantalla. Si después convertís sin modo en vivo, esas diapositivas quedan como diapositivas comunes.

En pantalla aparecen el QR para entrar, las barras que crecen con cada voto, la nube que se arma sola y las preguntas más apoyadas. Las preguntas **no se muestran hasta que vos las aprobás** desde tu celular.

### Sin servidor: a mano alzada

Funciona igual sin configurar nada: en las votaciones aparecen botones + y − para cargar las manos levantadas. Ideal si no hay buena conexión en la sala.

### Con servidor: la sala vota desde el celular (gratis)

El servidor está en la carpeta [`vivo/`](vivo/). Se publica en Vercel con una base Postgres gratis de Neon. Hacelo una vez y te sirve para todas tus charlas.

1. Hacé un fork de este repositorio, o subilo a tu cuenta de GitHub.
2. En [vercel.com/new](https://vercel.com/new) importá el repositorio. En **Root Directory** elegí `vivo` y tocá **Deploy**.
3. En el proyecto de Vercel, **Storage → Create Database → Neon**, y conectala al proyecto. Eso agrega `DATABASE_URL` solo.
4. En **Settings → Environment Variables** agregá `REMOTE_PIN` con un PIN de 4 a 8 dígitos (es tu clave de presentador).
5. **Deployments → Redeploy**. Listo: tu servidor queda en algo como `https://mi-charla.vercel.app`.

Las tablas se crean solas la primera vez. Para chequear que anda, abrí `https://mi-charla.vercel.app/api/salud`: tiene que decir `"ok":true,"pin":true`.

**El día de la charla:**

1. Pegá la dirección del servidor en el conversor (o apretá `C` en la presentación) y poné tu PIN.
2. En la ventana de conexión aparecen dos QR. Escaneá el de **control remoto** con tu celular: desde ahí pasás diapositivas, ves tus notas y el reloj, abrís y cerrás votaciones, moderás preguntas y quitás palabras de la nube.
3. El otro QR es para la sala, y también aparece solo en cada diapositiva de votación.

Los celulares siguen la presentación: cuando llegás a una votación, la pregunta les aparece sin volver a escanear. Antes de cada charla nueva, usá **Limpiar todos los datos** para borrar los votos de la anterior.

**Seguridad:** las notas del orador y los controles solo se ven con el PIN. Cinco PIN incorrectos bloquean esa conexión unos minutos. Cada celular vota una vez por pregunta (puede cambiar el voto), hay un tope de votos por red y la nube filtra insultos.

### Ensayar en tu computadora

Con [Node.js](https://nodejs.org) 20 o superior:

```bash
npm install
```

```bash
npm run vivo:local
```

Levanta el servidor en `http://localhost:4321` con PIN `1234` y una base en memoria. En la presentación apretá `C`, poné esa dirección y el PIN. Abrí `http://localhost:4321` en otra pestaña para votar como si fueras de la sala.

## Desde la terminal

Para convertir muchas presentaciones o automatizarlo (Node.js 20.12 o superior, sin instalar nada):

```bash
node convertir.mjs mi-charla.pptx --evento "Jornadas 2026" --vivo https://mi-charla.vercel.app
```

| Opción | Qué hace |
|---|---|
| `-o archivo.html` | Dónde guardar (por defecto, al lado del `.pptx`) |
| `--evento "texto"` | Nombre del evento, arriba de cada diapositiva y en el pie |
| `--vivo [dirección]` | Modo en vivo; la dirección del servidor es opcional |
| `--colores-ppt` | Usa los colores del tema del PowerPoint |
| `--color #hex` / `--color2 #hex` | Colores propios |
| `--logo logo.png` | Logo en el pie de cada diapositiva |
| `--todo-junto` | Los puntos aparecen todos juntos, no de a uno |
| `--sin-notas` | No incluye las notas del orador |

## Qué no se convierte

- **Gráficos y SmartArt** de PowerPoint: pegalos como imagen y volvé a convertir. El conversor te avisa en qué diapositiva están.
- **Videos y audio**: queda la imagen de portada del video.
- **Animaciones y transiciones propias** de PowerPoint: se reemplazan por las del estilo JoSEII.
- **Archivos `.ppt`, Keynote o Google Slides**: exportalos como `.pptx` primero (*Archivo → Descargar → PowerPoint* en Google Slides).
- **El diseño exacto de cada diapositiva**: el conversor toma el contenido y lo rediseña. Si una diapositiva depende de la posición exacta de las cosas, pegala como imagen.

## La charla original

[`ejemplos/joseii-2026/`](ejemplos/joseii-2026/) tiene la charla *Acelerar el desarrollo de software de toda una empresa con IA* (JoSEII Rosario 2026, UCA) tal como se presentó:

- [`sitio/`](ejemplos/joseii-2026/sitio/): la presentación hecha a mano, las páginas de votación, la calculadora en vivo, la práctica guiada y su API. Las notas del orador no están incluidas.
- [`animaciones/`](ejemplos/joseii-2026/animaciones/): el árbol que crece, hecho en [Remotion](https://www.remotion.dev). `render.sh` genera los videos.

Ese sitio fue el punto de partida: el conversor generaliza su estilo y su modo en vivo para que sirvan con cualquier presentación.

## Cómo está hecho

```
index.html         El conversor del navegador, generado: no lo edites a mano
convertir.mjs      El conversor de la terminal
construir.mjs      Arma index.html a partir de src/
src/
  zip.mjs          Abre el .pptx (es un zip) sin dependencias
  xml.mjs          Lee el XML de las diapositivas
  pptx.mjs         Extrae títulos, viñetas, tablas, imágenes y notas
  armar.mjs        Elige el diseño de cada diapositiva y arma el HTML
  motor.css        Estilo de las presentaciones
  motor.js         Navegación, notas, reloj y modo en vivo
  qr.mjs           Generador de códigos QR
  conversor.html   Plantilla de index.html
vivo/              Servidor del modo en vivo (Vercel + Neon)
pruebas/           Pruebas y servidor local de ensayo
ejemplos/          Presentación de ejemplo y la charla original
```

Si cambiás algo de `src/`, regenerá el conversor y corré las pruebas:

```bash
npm run construir
```

```bash
npm test
```

```bash
npm run probar:vivo
```

`npm test` revisa el conversor sin instalar nada. `npm run probar:vivo` prueba el servidor contra un Postgres real en memoria (necesita `npm install`). El generador de QR se verificó módulo por módulo contra la biblioteca `qrcode` de Python.
