var ele = document.getElementById('searchform');

function search(e) {
	e.preventDefault();
	if (document.getElementById('searchbox').value.trim() !== '') {
		window.location.href = '/search/#' + document.getElementById('searchbox').value.trim().split(' ').join('+');
	}
}

if(ele.addEventListener){
	ele.addEventListener("submit", search, false);
} else if(ele.attachEvent){
	ele.attachEvent('onsubmit', search);
}