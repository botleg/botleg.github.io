var form = document.getElementById('searchform'),
	box = document.getElementById('searchbox'),
	span = document.getElementById('query'),
	list = document.getElementById('search-list'),
	query = location.hash.slice(1),
	xhr = new XMLHttpRequest();

function searchFrm (e) {
	e.preventDefault();
	if (box.value.trim() !== '') {
		search(box.value.trim().split(' ').join('+'));
	}
}

function render (res) {
	if (!res.total) {
		list.innerHTML = '<span class="text">Sorry, No results.</span>';
		return;
	}
	list.innerHTML = "";
	for (var i=0; i<res.results.length; i++) {
		list.innerHTML += '<li><a class="post-link" href="/stories/'+res.results[i].id+'">'+res.results[i].title+'</a><p>'+res.results[i].summary+'</p></li>';
	}
}

function search (query) {
	span.innerHTML = query.split('+').join(' ');
	location.hash = query;
	list.innerHTML = '<span class="text">Loading results...</span>';

	xhr.open('GET', encodeURI('http://api.botleg.com/search/'+query));
	xhr.onload = function() {
		if (xhr.status === 200) {
			render(JSON.parse(xhr.responseText));
		}
	};
	xhr.send();
}

box.value = span.innerHTML = query.split('+').join(' ');
search(query);

if(form.addEventListener){
	form.addEventListener("submit", searchFrm, false);
} else if(form.attachEvent){
	form.attachEvent('onsubmit', searchFrm);
}