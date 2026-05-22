/**
 * Contiene funciones que manejan todo lo que es la grabacion del audio y video - todo en un solo archivo
 */

// Variables globales para mantener el estado de la grabación
let grabadorMedia = null;
let fragmentosVideo = [];
let intervaloTimer = null;

function inicializarGrabador(stream) {
    streamFisico = stream;
    if (!stream) {
        console.error("No se recibió un stream válido para inicializar el grabador.");
        return;
    }

    // Formato estandar
    const opciones = { mimeType: 'video/webm;codecs=vp9,opus' };
    
    try {
        grabadorMedia = new MediaRecorder(stream, opciones);
    } catch (e) {
        // Si falla usar el que tenga el navegador por defecto
        grabadorMedia = new MediaRecorder(stream);
    }

    grabadorMedia.ondataavailable = function(evento) {
        if (evento.data && evento.data.size > 0) {
            fragmentosVideo.push(evento.data);
        }
    };
}

function comenzarGrabacion() {
    if (!grabadorMedia) {
        console.error("El grabador no está inicializado. ¿Pasaste por la calibración?");
        return;
    }
    
    fragmentosVideo = [];
    grabadorMedia.start();
    console.log("Grabación iniciada...");
}

/**
 * Inicia un contador visual en la pantalla.
 * @param {number} segundos - Duración del timer (ej: 60)
 */
function iniciarTimerVisual(segundos) {
    // Limpiar timer
    if (intervaloTimer) clearInterval(intervaloTimer);

    let tiempoRestante = segundos;
    const display = document.getElementById('timer-display');

    if (display) {
        display.textContent = `Tiempo restante: ${tiempoRestante}s`;
    }

    intervaloTimer = setInterval(function() {
        tiempoRestante--;
        
        if (display) {
            display.textContent = `Tiempo restante: ${tiempoRestante}s`;
            
            // Opcional - poner timer en rijo
            if (tiempoRestante <= 10) {
                display.style.color = 'red';
                display.style.fontWeight = 'bold';
            }
        }

        if (tiempoRestante <= 0) {
            clearInterval(intervaloTimer);
            console.log("Tiempo cumplido. Avanzando de pantalla...");
            jsPsych.finishTrial(); // Para pasar a siguiente lamina automaticamente
        }
    }, 1000);
}

/**
 *  Detiene la grabación y fuerza la descarga local del archivo --> por ahora --> esto tengo que cambiarlo cuando lo sume 
 * @param {string} nombreLamina - El nombre que tendrá el archivo descargado
 */
function frenarYDescargar(nombreLamina = "grabacion_cookiejar") { // esto tiene que ser frenar y enviar al servidor
    if (!grabadorMedia || grabadorMedia.state === "inactive") {
        console.error("No hay ninguna grabación activa para detener.");
        return;
    }

    // Configuramos qué pasa CUANDO SE DETENGA la grabación
    grabadorMedia.onstop = function() {
        console.log("Grabación detenida. Procesando archivo...");

        // Crear blob de video
        const videoBlob = new Blob(fragmentosVideo, { type: 'video/webm' });

        // URL temporal apuntando a la memoria
        const urlDescarga = URL.createObjectURL(videoBlob);

        // Enlace invisible en el HTML
        const enlace = document.createElement('a');
        enlace.style.display = 'none';
        enlace.href = urlDescarga;
        enlace.download = `${nombreLamina}.webm`; // Nombre del archivo final

        document.body.appendChild(enlace);
        enlace.click();
        
        // Limpieza de memoria
        setTimeout(() => {
            document.body.removeChild(enlace);
            URL.revokeObjectURL(urlDescarga);
        }, 100);
    };

    grabadorMedia.stop();
}
// la idea es elimar esto totalmente

/**
 * Detiene la grabación y envía el archivo de video/audio al servidor de Datapruebas.
 * @param {string} nombreLamina - Identificador de la lámina actual (ej: "lamina_cookie_original")
 */
function frenarYEnviarServidor(nombreLamina = "grabacion_cookiejar") {
    if (!grabadorMedia || grabadorMedia.state === "inactive") {
        console.error("No hay ninguna grabación activa para detener.");
        return;
    }

    grabadorMedia.onstop = function() {
        console.log("Grabación detenida. Preparando envío al servidor..."); //debug

        const videoBlob = new Blob(fragmentosVideo, { type: 'video/webm' });

        let formData = new FormData();
        formData.append('audio', videoBlob, `grabacion_${runId}_${nombreLamina}.webm`);

        let url = `http://localhost:8000/api/v1/record_audio/${runId}/`; // https://datapruebas.org/api/v1/record_audio/<run-id>/
        console.log(`Enviando archivo a: ${url}`); //debug

        fetch(url, {
            method: 'POST',
            credentials: "include", 
            headers: {
            },
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error en el servidor: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Archivo subido con éxito al servidor", data); //debug
        })
        .catch(error => {
            console.error("Hubo un problema al subir el archivo:", error); //debug
        });
    };

    grabadorMedia.stop();
}

function apagarCamaraYMicofono() {
    if (streamFisico) {
        streamFisico.getTracks().forEach(track => track.stop());
        console.log("Hardware liberado y apagado.");
    }
}
// agregar funcion que le avise a datapruebas que el sujeto termino el experiment