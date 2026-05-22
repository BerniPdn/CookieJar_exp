/* Settings */

const queryParams = new URLSearchParams(window.location.search);
var run_id = queryParams.get('run-id');

var domain = 'localhost:8000';
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


async function storeProgress(a_number) {
    let url = `${protocol}://${domain}/api/v1/record_data/${run_id}/`;
    return fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
	        "X-CSRFToken": getCookie("csrftoken")
        },
        body: JSON.stringify({ "progress": a_number })
    })
       .then(response => response.json())
       .then(response => console.log(JSON.stringify(response)))
}

async function fetchProgress() {
    let url = `${protocol}://${domain}/api/v1/fetch_progress/${run_id}/`;
    return fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
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

$(document).ready(function() {
	$('#step-1').show();
})

function stepOneDone() {
	recordData("step one done.");
	storeProgress(30)

	$('#step-1').hide();
	$('#step-2').show();

}

function stepTwoDone() {   
	recordData([{"message": "step two done."}, {"numeric": 2}]);
    storeProgress(70)
	$('#step-2').hide();
	$('#step-3').show();

}

async function finishExperiment() {
	endExperiment(20)
    .then(response => response.json())
    .then(response => {
		console.log(JSON.stringify(response))
		if (response['status'] == 'OK') { 
			$('#step-3').hide();
			$('#experiment-end').show();
		}
   });
   
   let response = await fetchProgress();
   let jsonResponse = await response.json();
   alert('El progreso registrado es:' + JSON.stringify(jsonResponse['progress']));

}