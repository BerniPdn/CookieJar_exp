/**
 * Contiene todas las funciones encargadas de manejar la grabacion
 */

// Variables globales para mantener el estado de la grabación
let grabadorMedia = null;
let fragmentosVideo = [];
let intervaloTimer = null;
let streamFisico = null;

function inicializarGrabador(stream) {
    streamFisico = stream;
    if (!stream) {
        console.error("No se recibió un stream válido para inicializar el grabador.");
        return;
    }

    // Achicando el tamaño del video
    const opciones = { 
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: 5000000
    };
    
    try {
        grabadorMedia = new MediaRecorder(stream, opciones);
        console.log("Grabador inicializado en maxima calidad");
    } catch (e) {
        // Si falla usar el que tenga el navegador por defecto
        grabadorMedia = new MediaRecorder(stream);
        console.warn("Fallo plan A (vp8), intentando Plan B de alta calidad sin códec forzado", e);
            try {
                grabadorMedia = new MediaRecorder(stream, { videoBitsPerSecond: 5000000 });
                console.log("Grabador inicializado en Alta Calidad")
            } catch (err) {
                grabadorMedia = new MediaRecorder(stream);
                console.error("Fallo plan B. Inicializado en modo por defecto del navegador", err);
            }
        }

    grabadorMedia.ondataavailable = function(evento) {
        if (evento.data && evento.data.size > 0) {
            // Por si la compu del paciente se queda sin espacio
            try {
                fragmentosVideo.push(evento.data);   
            } catch (error) {
                console.error("ERROR CRÍTICO: Se agotó el espacio de almacenamiento temporal del navegador.", error);
                console.warn("Intentando salvar los datos capturados hasta el momento...");
                if (mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                }
            }
        }
    }
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
function iniciarTimerVisual(segundos, nombreArchivo) {
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
            
            // Opcional - poner timer en rojo
            if (tiempoRestante <= 10) {
                display.style.color = 'red';
                display.style.fontWeight = 'bold';
            }
        }

        if (tiempoRestante <= 0) {
            clearInterval(intervaloTimer);
            console.log("Tiempo cumplido. Avanzando de pantalla...");
            frenarYEnviarServidor(nombreArchivo);
        }
    }, 1000);
}

/**
 * Muestra pantalla de carga si el internet es lento
 */
function mostrarPantallaCarga() {
    if (document.getElementById('blocking-loader-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'blocking-loader-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)'; // Fondo semitransparente oscuro
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '999999'; // Nos aseguramos de que esté por encima de cualquier elemento de jsPsych
    overlay.style.color = '#ffffff';
    overlay.style.fontFamily = 'Arial, sans-serif';

    // Spinner
    const spinner = document.createElement('div');
    spinner.style.border = '8px solid #f3f3f3';
    spinner.style.borderTop = '8px solid #3498db'; // Color azul de carga
    spinner.style.borderRadius = '50%';
    spinner.style.width = '60px';
    spinner.style.height = '60px';
    spinner.style.animation = 'spin 1.2s linear infinite';

    // Animación CSS de rotación
    if (!document.getElementById('spinner-keyframes')) {
        const style = document.createElement('style');
        style.id = 'spinner-keyframes';
        style.innerHTML = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    //Cartel de aviso con indicaciones para que el paciente no entre en pánico
    const mensaje = document.createElement('p');
    mensaje.style.marginTop = '25px';
    mensaje.style.fontSize = '1.3rem';
    mensaje.style.fontWeight = 'bold';
    mensaje.style.textAlign = 'center';
    mensaje.innerHTML = 'Subiendo grabación al servidor ...<br><span style="font-size: 1rem; color: #f1c40f; font-weight: normal;">Por favor, no cierre la pestaña ni recargue la página.</span>';

    overlay.appendChild(spinner);
    overlay.appendChild(mensaje);
    document.body.appendChild(overlay);
}

function ocultarPantallaCarga() {
    const overlay = document.getElementById('blocking-loader-overlay');
    if (overlay) {
        overlay.remove();
    }
}

/**
 * Detiene la grabacion y envia un archivo .webm al servidor
 * @param {*} nombreArchivo 
 */
function frenarYEnviarServidor(nombreArchivo) {
    if (intervaloTimer) clearInterval(intervaloTimer);
    
    if (!grabadorMedia || grabadorMedia.state === "inactive") {
        console.error("No hay ninguna grabación activa para detener.");
        return;
    }

    grabadorMedia.onstop = function() {
        mostrarPantallaCarga();
        
        const videoBlob = new Blob(fragmentosVideo, { type: 'video/webm' });
        console.log(`Subiendo grabación de: ${nombreArchivo}...`);

        recordVideo(videoBlob, `grabacion_${run_id}_${nombreArchivo}`)
        .then(() => {
            const trialData = jsPsych.data.get().last(1).values()[0] || {};
            recordData({
                trial: nombreArchivo,
                rt: trialData.rt || null,
                timeout: trialData.rt === undefined || trialData.rt === null
            });
        })
        .then(() => {
            ocultarPantallaCarga();
            jsPsych.finishTrial();
        })
        .catch(error => {
            // Si hay un error de red (ej: se cayó internet), ocultamos la carga y dejamos continuar al paciente.
            console.error("Fallo crítico en la subida, continuando experimento de todos modos:", error);
            ocultarPantallaCarga();
            jsPsych.finishTrial();
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