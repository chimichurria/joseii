#!/usr/bin/env python3
"""Genera ejemplos/demo.pptx: una presentación corta que usa todo lo que el conversor entiende.

Necesita python-pptx (pip install python-pptx). Solo hace falta para regenerar el ejemplo.
"""
import pathlib
import struct
import zlib

from pptx import Presentation
from pptx.util import Inches, Pt

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "ejemplos" / "demo.pptx"


def png_degradado(ancho=640, alto=400):
    """PNG chico generado a mano, para no depender de ninguna imagen externa."""
    filas = b""
    for y in range(alto):
        fila = bytearray([0])
        for x in range(ancho):
            t = x / ancho
            franja = ((x // 40) + (y // 40)) % 2
            fila += bytes([255, int(51 + 102 * t) + franja * 12, int(40 * (1 - t)) + franja * 20])
        filas += bytes(fila)

    def bloque(tipo, datos):
        cuerpo = tipo + datos
        return struct.pack(">I", len(datos)) + cuerpo + struct.pack(">I", zlib.crc32(cuerpo) & 0xFFFFFFFF)

    return b"\x89PNG\r\n\x1a\n" + bloque(b"IHDR", struct.pack(">IIBBBBB", ancho, alto, 8, 2, 0, 0, 0)) + bloque(b"IDAT", zlib.compress(filas, 9)) + bloque(b"IEND", b"")


def puntos(diapositiva, lineas):
    """lineas: lista de textos, o de (texto, nivel)."""
    marco = diapositiva.placeholders[1].text_frame
    marco.clear()
    for i, linea in enumerate(lineas):
        texto, nivel = linea if isinstance(linea, tuple) else (linea, 0)
        p = marco.paragraphs[0] if i == 0 else marco.add_paragraph()
        p.text = texto
        p.level = nivel


def nueva(prs, disposicion, titulo, notas=""):
    d = prs.slides.add_slide(prs.slide_layouts[disposicion])
    if d.shapes.title is not None:
        d.shapes.title.text = titulo
    if notas:
        d.notes_slide.notes_text_frame.text = notas
    return d


def principal():
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
    prs.core_properties.title = "Cómo dar una charla que la sala no se olvide"

    d = nueva(prs, 0, "Cómo dar una charla que la sala no se olvide", "[1 min] Presentarse en una frase y pasar directo a la pregunta.")
    d.placeholders[1].text = "De las diapositivas de siempre a una charla en vivo"

    d = nueva(prs, 1, "NUBE: ¿Qué te trae hoy?", "Mientras la gente entra, que escanee y conteste. La nube crece sola.")
    puntos(d, ["Una palabra alcanza"])

    d = nueva(prs, 1, "VOTAR: ¿Cuánto dura la atención de una sala?", "[2 min] Dar un minuto para votar. No decir la respuesta todavía.")
    puntos(d, ["Menos de 5 minutos", "Unos 10 minutos", "Media hora", "Toda la charla, si es buena"])

    nueva(prs, 2, "Primero, el problema")

    d = nueva(prs, 1, "Una charla común pierde a la sala por tres motivos", "[3 min] Un clic por tarjeta. Contar un ejemplo propio en cada una.")
    puntos(d, [
        "Demasiado texto", ("La sala lee más rápido de lo que hablás", 1), ("Y deja de escucharte", 1),
        "Nadie participa", ("Pasan 40 minutos sin que nadie haga nada", 1),
        "No hay hilo", ("Las diapositivas no cuentan una historia", 1),
    ])

    d = nueva(prs, 1, "Lo que cambia cuando la sala participa", "[2 min] Un clic por punto.")
    puntos(d, ["Preguntás antes de explicar", "Mostrás el resultado en pantalla", "Usás lo que votaron para seguir", "Cerrás volviendo a la primera pregunta"])

    d = nueva(prs, 1, "Minutos que aguanta una sala sin participar")
    puntos(d, ["10", "Después de eso, la atención cae. Es un valor de ejemplo: medilo con tu público."])

    d = nueva(prs, 1, "Para llevarse")
    puntos(d, ["“Un problema bien planteado está medio resuelto.”", "Atribuida a Charles Kettering"])

    d = nueva(prs, 5, "Las tres maneras de usarlo")
    filas = [("Modo", "Qué necesitás", "Para qué sirve"), ("Solo HTML", "Nada", "Presentar sin internet"), ("A mano alzada", "Nada", "Contar votos con + y −"), ("En vivo", "Un servidor gratis", "La sala vota desde el celular")]
    tabla = d.shapes.add_table(len(filas), 3, Inches(0.8), Inches(1.8), Inches(11.7), Inches(3.2)).table
    for i, fila in enumerate(filas):
        for j, celda in enumerate(fila):
            tabla.cell(i, j).text = celda

    d = nueva(prs, 1, "Tus imágenes viajan adentro del archivo", "Las imágenes quedan incrustadas: el HTML es un solo archivo.")
    puntos(d, ["No hay carpetas que copiar", "Funciona sin internet", "Se abre con doble clic"])
    imagen = RAIZ / "pruebas" / "_demo.png"
    imagen.write_bytes(png_degradado())
    d.shapes.add_picture(str(imagen), Inches(7.4), Inches(1.9), width=Inches(5.2))
    imagen.unlink()

    d = nueva(prs, 5, "Un cuadro de texto suelto también se convierte")
    caja = d.shapes.add_textbox(Inches(1), Inches(2.2), Inches(11), Inches(2)).text_frame
    caja.text = "No hace falta usar las plantillas de PowerPoint: los cuadros de texto sueltos, como los de Canva o Google Slides, se leen igual."
    caja.paragraphs[0].runs[0].font.size = Pt(24)

    nueva(prs, 5, "¿Preguntas?", "[5 min] Las preguntas llegan al celular del orador. Solo aparecen en pantalla las que apruebe.")

    d = nueva(prs, 1, "Gracias", "Cerrar volviendo a la votación del principio.")
    puntos(d, ["Convertí tu próxima charla en github.com/chimichurria/joseii"])

    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(SALIDA))
    print("Listo:", SALIDA, "con", len(prs.slides), "diapositivas")


if __name__ == "__main__":
    principal()
