
"""
Servidor local de pruebas para el experimento CookieJar (Actualizado).
Emula los endpoints de datapruebas.org para recibir audios/videos y datos de jsPsych.
Hecho con Gemini - Modificado para soportar la nueva API de record_video en el puerto 8002.
"""

import os
from flask import Flask, request, jsonify

app = Flask(__name__)

# Creamos la carpeta donde se guardarán los videos si no existe
CARPETA_GRABACIONES = '/Users/berni/Desktop/grabaciones_cookiejar'
os.makedirs(CARPETA_GRABACIONES, exist_ok=True)

# Configuración de cabeceras para permitir CORS (Cross-Origin Resource Sharing)
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-CSRFToken')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# =========================================================================
# NUEVO ENDPOINT: Recibe el archivo de video (.webm) bajo la clave 'video'
# =========================================================================
@app.route('/api/v1/record_video/<run_id>/', methods=['POST', 'OPTIONS'])
def record_video(run_id):
    if request.method == 'OPTIONS':
        return jsonify({"status": "OK"}), 200
        
    print(f"\n🎥 [VIDEO] Petición entrante para la sesión (run-id): {run_id}")
    
    # Comprobamos que el archivo venga bajo la clave 'video' como pide la nueva API
    if 'video' not in request.files:
        print("❌ Error: No se encontró la clave 'video' en el archivo enviado.")
        return jsonify({"status": "FAIL", "error": "Falta archivo de video"}), 400
        
    archivo = request.files['video']
    if archivo.filename == '':
        print("❌ Error: Nombre de archivo vacío.")
        return jsonify({"status": "FAIL", "error": "Nombre de archivo vacío"}), 400

    # Construimos la ruta de destino y guardamos el archivo físico en el disco
    ruta_guardado = os.path.join(CARPETA_GRABACIONES, archivo.filename)
    archivo.save(ruta_guardado)
    
    print(f"✅ ¡Video guardado con éxito localmente!")
    print(f"   📂 Ubicación: {ruta_guardado}")
    return jsonify({"status": "OK"}), 200


# 2. Endpoint para recibir las métricas cualitativas de jsPsych (tiempos de reacción, etc.)
@app.route('/api/v1/record_data/<run_id>/', methods=['POST', 'OPTIONS'])
def record_data(run_id):
    if request.method == 'OPTIONS':
        return jsonify({"status": "OK"}), 200
        
    datos = request.json
    print(f"\n[DATOS] Métricas cualitativas recibidas para run-id [{run_id}]:")
    print(f"   📊 Contenido: {datos}")
    return jsonify({"status": "OK"}), 200


# 3. Endpoint para finalizar la corrida experimental
@app.route('/api/v1/end_run/<run_id>/', methods=['POST', 'OPTIONS'])
def end_run(run_id):
    if request.method == 'OPTIONS':
        return jsonify({"status": "OK"}), 200
        
    # Agregamos un .get por si mandan el body vacío al finalizar
    datos = request.json if request.is_json else {}
    print(f"\n🏁 [FIN] El experimento finalizó para run-id [{run_id}].")
    print(f"   🏆 Puntaje final (Score): {datos.get('score', 'No especificado') if datos else 'No especificado'}")
    return jsonify({"status": "OK"}), 200


if __name__ == '__main__':
    print("====================================================")
    print(" Iniciando Servidor de Pruebas Local (CookieJar) ")
    print(" Actualizado al puerto de la nueva API: 8002 ")
    print(" Escuchando en: http://localhost:8002 ")
    print("====================================================")
    # CAMBIO CRÍTICO: Ahora corre en el puerto 8002 para que tu JavaScript no rebote
    app.run(port=8002, debug=True)