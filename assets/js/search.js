var form = document.getElementById('searchform'),
	box = document.getElementById('searchbox'),
	span = document.getElementById('query'),
	list = document.getElementById('search-list'),
	pagination = document.getElementById('pagination'),
	prevAct = document.getElementById('prevAct'),
	prevText = document.getElementById('prevText'),
	nextAct = document.getElementById('nextAct'),
	nextText = document.getElementById('nextText'),
	query = location.hash.slice(1),
	xhr = new XMLHttpRequest(),
	cPage = 1, tPage;

function render (results) {
	list.innerHTML = "";
	for (var i=0; i<results.length; i++) {
		list.innerHTML += '<li><a class="post-link" href="/stories/'+results[i].id+'">'+results[i].title+'</a><p>'+results[i].summary+'</p></li>';
	}
}

function updatePaging() {
	if (cPage > 1) {
		prevAct.style.display = 'block';
		prevText.style.display = 'none';
	} else {
		prevAct.style.display = 'none';
		prevText.style.display = 'block';
	}

	if (cPage < tPage) {
		nextAct.style.display = 'block';
		nextText.style.display = 'none';
	} else {
		nextAct.style.display = 'none';
		nextText.style.display = 'block';
	}
}

function loadPage() {
	list.innerHTML = '<span class="text">Loading results...</span>';

	xhr.open('GET', encodeURI('http://api.botleg.com/search/'+query+'/'+cPage));
	xhr.onload = function() {
		if (xhr.status === 200) {
			render(JSON.parse(xhr.responseText).results);
		}
	};
	xhr.send();
}

function nextPage (e) {
	e.preventDefault();
	cPage++;
	loadPage();
	updatePaging();
}

function prevPage (e) {
	e.preventDefault();
	cPage--;
	loadPage();
	updatePaging();
}

function showResult (res) {
	if (!res.total) {
		list.innerHTML = '<span class="text">Sorry, No results.</span>';
		return;
	}

	render(res.results);

	tPage = Math.floor((res.total-1)/10+1);
	if (tPage > 1) {
		updatePaging();
		pagination.style.display = 'block';
	}
}

function search () {
	span.innerHTML = query.split('+').join(' ');
	location.hash = query;
	pagination.style.display = 'none';
	cPage = 1;
	list.innerHTML = '<span class="text">Loading results...</span>';

	xhr.open('GET', encodeURI('http://api.botleg.com/search/'+query));
	xhr.onload = function() {
		if (xhr.status === 200) {
			showResult(JSON.parse(xhr.responseText));
		}
	};
	xhr.send();
}

function searchFrm (e) {
	e.preventDefault();
	if (box.value.trim() !== '') {
		query = box.value.trim().split(' ').join('+');
		search();
	}
}

pagination.style.display = 'none';
box.value = span.innerHTML = query.split('+').join(' ');
search();

if(form.addEventListener){
	form.addEventListener("submit", searchFrm, false);
	nextAct.addEventListener("click", nextPage, false);
	prevAct.addEventListener("click", prevPage, false);
} else if(form.attachEvent){
	form.attachEvent('onsubmit', searchFrm);
	nextAct.attachEvent('onclick', nextPage);
	prevAct.attachEvent('onclick', prevPage);
}