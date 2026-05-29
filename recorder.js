/**
 * Contiene todas las funciones encargadas de manejar la grabacion
 */

// Variables globales para mantener el estado de la grabación
let grabadorMedia = null;
let fragmentosVideo = [];
let intervaloTimer = null;
let streamFisico = null;
let colaSubidas = Promise.resolve();

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
    grabadorMedia.start(1000); 
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
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '999999'; 
    overlay.style.color = '#ffffff';
    overlay.style.fontFamily = 'Arial, sans-serif';

    // Spinner
    const spinner = document.createElement('div');
    spinner.style.border = '8px solid #f3f3f3';
    spinner.style.borderTop = '8px solid #3498db'; 
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
    mensaje.innerHTML = 'Subiendo grabaciones al servidor ...<br><span style="font-size: 1rem; color: #f1c40f; font-weight: normal;">Por favor, no cierre la pestaña ni recargue la página.</span>';

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
* Detiene la grabación asegurando una única ejecución por pantalla.
* Previene el bug de sobreescritura y asegura la cola de subidas de fondo.
*/
function frenarYEnviarServidor(nombreArchivo) {
    if (intervaloTimer) clearInterval(intervaloTimer);
    
    // ESCUDO CRÍTICO: Si no hay grabador, o ya está inactivo, o está en proceso de cerrarse ('inactive'), abortamos de inmediato.
    // Esto evita que el click manual y el timer automático choquen y vacíen el array dos veces.
    if (!grabadorMedia || grabadorMedia.state === "inactive") {
        console.warn(`[Fila] Bloqueado: Intento de doble freno ignorado para: ${nombreArchivo}`);
        return;
    }
 
    console.log(`[Fila] Iniciando proceso de frenado para: ${nombreArchivo}. State actual: ${grabadorMedia.state}`);
 
    grabadorMedia.onstop = function() {
        if (fragmentosVideo.length === 0) {
            console.warn(`[Fila] Alerta preventiva: El array global ya estaba vacío en onstop para ${nombreArchivo}.`);
            return;
        }
 
        console.log(`[Cola] Hardware detenido en limpio. Paquetes acumulados: ${fragmentosVideo.length}`);
        
        const fragmentosDeEsteTrial = [...fragmentosVideo];
        fragmentosVideo = []; 
        
        const videoBlob = new Blob(fragmentosDeEsteTrial, { type: 'video/webm' });
        console.log(`[Cola] Blob creado con éxito para ${nombreArchivo}. Tamaño real asegurado: ${videoBlob.size} bytes.`);
 
        colaSubidas = colaSubidas.then(() => {
            console.log(`[Cola] -> Arrancando transmisión de fondo: ${nombreArchivo} (${videoBlob.size} bytes)`);
            
            return recordVideo(videoBlob, `grabacion_${run_id}_${nombreArchivo}`)
                .then(() => {
                    const trialData = jsPsych.data.get().last(1).values()[0] || {};
                    return recordData({
                        trial: nombreArchivo,
                        rt: trialData.rt || null,
                        timeout: trialData.rt === undefined || trialData.rt === null
                    });
                })
                .then(() => {
                    console.log(`[Cola] -> ¡Éxito total en el servidor para: ${nombreArchivo}!`);
                })
                .catch(error => {
                    console.error(`[Cola] -> Error de red en fondo para ${nombreArchivo}:`, error);
                });
        });
 
        console.log(`[Cola] Liberando pantalla del paciente al instante.`);
        jsPsych.finishTrial();
    };
 
    grabadorMedia.stop();
 }

/**
* FUNCIÓN PARA EL INDEX.HTML: Permite consultar el estado de la fila al final.
*/
function esperarQueTermineLaCola() {
   return colaSubidas;
}

function apagarCamaraYMicofono() {
    if (streamFisico) {
        streamFisico.getTracks().forEach(track => track.stop());
        console.log("Hardware liberado y apagado.");
    }
}