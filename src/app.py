from flask import Flask, render_template, jsonify, request
import numpy as np
import wfdb

app = Flask(__name__)

# --- MOTOR MATEMÁTICO DE RUIDO CLÍNICO ---
def aplicar_artefacto(signal_np, tipo_ruido):
    if tipo_ruido == 'temblor':
        ruido = np.random.normal(0, 0.15, len(signal_np))
        return (signal_np + ruido).tolist()
    elif tipo_ruido == 'respiracion':
        t = np.linspace(0, 3, len(signal_np)) 
        ruido = 0.8 * np.sin(2 * np.pi * 0.3 * t)
        return (signal_np + ruido).tolist()
    return signal_np.tolist()

@app.route('/')
def inicio():
    return render_template('index.html')

# --- RUTA NUEVA: PTB-XL (12 DERIVACIONES ESTRICTAS) ---
@app.route('/api/ecg/ptb-xl/<path:paciente_id>')
def obtener_12_derivaciones(paciente_id):
    try:
        tipo_ruido = request.args.get('ruido', 'limpio')
        
        # 1. PTB-XL usa 3 niveles: "records500/00000/00001_hr"
        partes = paciente_id.split('/')
        carpeta = f"{partes[0]}/{partes[1]}"  # "records500/00000"
        archivo = partes[2]                   # "00001_hr"
        
        # 2. URL estricta a la versión 1.0.3 de PTB-XL
        directorio_exacto = f'ptb-xl/1.0.3/{carpeta}'
        
        # 3. Descargamos el registro (Suelen ser 10 segundos)
        record = wfdb.rdrecord(archivo, pn_dir=directorio_exacto)
        
        # 4. Cálculo matemático clínico: 
        # Aseguramos exactamente 3 segundos según su frecuencia de muestreo real
        fs = record.fs
        muestras_3_segundos = int(fs * 3) 
        
        nombres_canales_db = [str(c).lower().strip() for c in record.sig_name]
        derivaciones = {}
        canales_deseados = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6']
        
        for canal in canales_deseados:
            canal_minuscula = canal.lower().strip()
            
            if canal_minuscula in nombres_canales_db:
                indice = nombres_canales_db.index(canal_minuscula)
                # Extraemos y recortamos a exactamente 3 segundos
                senal_limpia = np.nan_to_num(record.p_signal[:muestras_3_segundos, indice])
                senal_procesada = aplicar_artefacto(senal_limpia, tipo_ruido)
                derivaciones[canal] = senal_procesada
            else:
                derivaciones[canal] = [0] * muestras_3_segundos

        return jsonify({
            "estado": "exito", 
            "paciente": paciente_id,
            "frecuencia_muestreo": fs, 
            "datos_12_derivaciones": derivaciones
        })
    except Exception as e:
        return jsonify({"estado": "error", "mensaje": f"Error PhysioNet (PTB-XL): {str(e)}"})

if __name__ == '__main__':
    app.run(debug=True)