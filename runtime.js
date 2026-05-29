/* Settings */

const queryParams = new URLSearchParams(window.location.search);
var run_id = queryParams.get('run-id');

var domain = 'localhost:8002';
var protocol = 'http';
//var domain = 'npdev.liaa.dc.uba.ar';
//var protocol = 'https';


/* Library */

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

function recordData(aJsonObject) {
	let url = `${protocol}://${domain}/api/v1/record_data/${run_id}/`;
	fetch(url, {
	    method: 'POST',
	    headers: {
	        'Accept': 'application/json',
	        'Content-Type': 'application/json',
	        "X-CSRFToken": getCookie("csrftoken")
	    },
	    body: JSON.stringify({ "data": aJsonObject })
	})
	   .then(response => response.json())
	   .then(response => console.log(JSON.stringify(response)));
	   
}

function recordVideo(blobVideo, nombreArchivo) {
    let url = `${protocol}://${domain}/api/v1/record_video/${run_id}/`;
    
    let formData = new FormData();
    formData.append('video', blobVideo, `${nombreArchivo}.webm`);

    return fetch(url, {
        method: 'POST',
        headers: {
            "X-CSRFToken": getCookie("csrftoken")
        },
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error en servidor Datapruebas: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("Video guardado con éxito en servidor:", JSON.stringify(data));
        return data;
	});
	}

function endExperiment(score) {
	return fetch(`${protocol}://${domain}/api/v1/end_run/${run_id}/`, {
	    method: 'POST',
	    headers: {
	        'Accept': 'application/json',
	        'Content-Type': 'application/json',
	        "X-CSRFToken": getCookie("csrftoken")
	    },
	    body: JSON.stringify({ "score": score })
	})
}

/* App */
async function finishExperiment() {
	endExperiment(100)
}