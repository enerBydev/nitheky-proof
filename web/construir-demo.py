#!/usr/bin/env python3
"""Genera demo.html: la MISMA página de index.html con el motor incrustado.

Un solo archivo que se abre con doble clic y funciona sin servidor ni repo —
para revisar la demo antes de publicarla, o para enseñarla sin conexión.

No es una copia del código: coge index.html, sustituye la línea de import
por el bundle IIFE del motor, y escribe demo.html. Si cambia index.html o
motor/, se regenera y no pueden divergir.
"""
import subprocess
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent

# 1 · el motor como IIFE global NITHEKY
subprocess.run(
    [
        "npx", "-y", "esbuild",
        str(RAIZ / "web" / "entrada.ts"),
        "--bundle", "--format=iife", "--global-name=NITHEKY",
        "--platform=browser", "--minify",
    ],
    check=True,
    capture_output=True,
    text=True,
    cwd=RAIZ,
)
bundle = subprocess.run(
    ["npx", "-y", "esbuild", str(RAIZ / "web" / "entrada.ts"),
     "--bundle", "--format=iife", "--global-name=NITHEKY",
     "--platform=browser", "--minify"],
    check=True, capture_output=True, cwd=RAIZ,
).stdout.decode()

html = (RAIZ / "index.html").read_text(encoding="utf-8")

# 2 · el import del módulo se convierte en desestructuración del global
viejo = '''import {
  proyectar, longitudPolilinea, buscarConductores, evaluar,
  MotorReserva,
  conductoresMozambique, pasajeroZimpetoMarracuene, pasajeroZimpetoMaputo,
  pasajeroCacuacoViana, pasajeroVianaLuanda,
  CORREDOR_MZ, CORREDOR_AO,
} from "./motor.js";'''
nuevo = (
    "const {\n"
    "  proyectar, longitudPolilinea, buscarConductores, evaluar,\n"
    "  MotorReserva,\n"
    "  conductoresMozambique, pasajeroZimpetoMarracuene, pasajeroZimpetoMaputo,\n"
    "  pasajeroCacuacoViana, pasajeroVianaLuanda,\n"
    "  CORREDOR_MZ, CORREDOR_AO,\n"
    "} = NITHEKY;"
)
assert viejo in html, "index.html cambió: actualice construir-demo.py"
html = html.replace(viejo, nuevo)

# 3 · el bundle va ANTES del script de la página
marcador = "<script type=\"module\">"
assert marcador in html
html = html.replace(
    marcador,
    "<script>\n" + bundle + "\n</script>\n" + marcador,
    1,
)
html = html.replace(
    "<title>NITHEKY — same-direction matching · technical proof</title>",
    "<title>NITHEKY — same-direction matching · technical proof</title>\n"
    "<!-- demo.html: archivo autónomo generado por web/construir-demo.py — no editar a mano -->",
)

(RAIZ / "demo.html").write_text(html, encoding="utf-8")
print("demo.html generado:", f"{len(html)//1024} KB, autónomo (motor incrustado)")
