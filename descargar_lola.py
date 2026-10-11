import os
import urllib.request
import numpy as np
import struct

url = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_80s_80m.img"
archivo_img = "ldem_80s_80m.img"

if not os.path.exists(archivo_img):
    print("Descargando modelo LOLA (145 MB)...")
    urllib.request.urlretrieve(url, archivo_img)

print("Procesando mapa colosal regional...")
filas_total = 7600
cols_total = 7600

# Leer enteros de 16 bits y pasar a metros
datos_crudos = np.fromfile(archivo_img, dtype=np.int16).reshape((filas_total, cols_total))
datos_metros = datos_crudos.astype(np.float32) * 0.5

# RECORTE AMPLIADO: 640x640 km (4000x4000 a 160 m/celda)
# Cubre polo sur hasta ~81°S, incluye Malapert, Cabeus, Haworth, etc.
radio_recorte = 2000  # 2000 celdas * 160 m = 320 km radius = 640 km diameter
centro_f = filas_total // 2
centro_c = cols_total // 2

recorte_grande = datos_metros[
    centro_f - radio_recorte : centro_f + radio_recorte,
    centro_c - radio_recorte : centro_c + radio_recorte
]

# SUBMUESTREO (Paso 2): 4000x4000 -> 2000x2000 NO, mantener 4000x4000 para mapa grande
# recorte_optimizado = recorte_grande[::2, ::2]  # COMENTADO: usamos resolución completa

os.makedirs("public/data", exist_ok=True)
ruta_salida = "public/data/lola_shackleton.bin"

rows, cols = recorte_grande.shape
mpc = 160

# Escribir cabecera: 3 int32 (rows, cols, mpc) + datos float32
with open(ruta_salida, 'wb') as f:
    f.write(struct.pack('<iii', rows, cols, mpc))
    recorte_grande.tofile(f)

print(f"¡Éxito! Mapa colosal guardado.")
print(f"Dimensiones de la nueva cuadrícula: {rows} x {cols}")
print(f"Cobertura física: {cols*mpc/1000:.0f} km x {rows*mpc/1000:.0f} km a {mpc} metros/celda.")