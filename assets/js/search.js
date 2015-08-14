var form = document.getElementById('searchform'),
	box = document.getElementById('searchbox'),
	span = document.getElementById('query'),
	query = location.hash.slice(1);

function searchFrm(e) {
	e.preventDefault();
	if (box.value.trim() !== '') {
		search(box.value.trim().split(' ').join('+'));
	}
}

function search (query) {
	span.innerHTML = query.split('+').join(' ');
}

box.value = span.innerHTML = query.split('+').join(' ');
search(query);

if(form.addEventListener){
	form.addEventListener("submit", searchFrm, false);
} else if(form.attachEvent){
	form.attachEvent('onsubmit', searchFrm);
}

var xhr = new XMLHttpRequest();
xhr.open('GET', encodeURI('http://api.botleg.com/search/'+query));
xhr.onload = function() {
    if (xhr.status === 200) {
        console.log(JSON.parse(xhr.responseText));
    }
};
xhr.send();