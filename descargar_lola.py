import os
import urllib.request
import numpy as np

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

# RECORTE MASIVO: 4000x4000 píxeles (320 km x 320 km)
radio_recorte = 2000
centro_f = filas_total // 2
centro_c = cols_total // 2

recorte_grande = datos_metros[
    centro_f - radio_recorte : centro_f + radio_recorte,
    centro_c - radio_recorte : centro_c + radio_recorte
]

# SUBMUESTREO (Paso 2): Matriz final optimizada de 2000x2000 vértices
recorte_optimizado = recorte_grande[::2, ::2]

os.makedirs("public/data", exist_ok=True)
ruta_salida = "public/data/lola_shackleton.bin"
recorte_optimizado.tofile(ruta_salida)

print(f"¡Éxito! Mapa colosal guardado.")
print(f"Dimensiones de la nueva cuadrícula: {recorte_optimizado.shape[0]} x {recorte_optimizado.shape[1]}")
print(f"Cobertura física: 320 km x 320 km a 160 metros/celda.")