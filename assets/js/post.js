var searchbox = document.getElementById('searchform'),
	comments = document.getElementById('comments'),
	newComment = document.getElementById('new-comment'),
	nameField = document.getElementById('nameField'),
	textField = document.getElementById('textField'),
	commentBtn = document.getElementById('commentBtn'),
	length = 0,
	xhr = new XMLHttpRequest();

function search(e) {
	e.preventDefault();
	if (document.getElementById('searchbox').value.trim() !== '') {
		window.location.href = '/search/#' + document.getElementById('searchbox').value.trim().split(' ').join('+');
	}
}

function render(json) {
	length = json.length;
	if (!length) {
		comments.innerHTML = '<p class="comment-block text">No comments yet.</p>';
		return;
	}
	
	comments.innerHTML = "";
	for (var i=0; i<json.length; i++) {
		comments.innerHTML += '<p class="comment-block"><span class="text">'+json[i].name+'</span><br/>'+json[i].text+'</p>';
	}
}

function add() {
	if (length++) {
		comments.innerHTML = '<p class="comment-block"><span class="text">'+nameField.value+'</span><br/>'+textField.value+'</p>' + comments.innerHTML;
	} else {
		comments.innerHTML = '<p class="comment-block"><span class="text">'+nameField.value+'</span><br/>'+textField.value+'</p>';
	}

	nameField.value = "";
	textField.value = "";
	commentBtn.disabled = false;
	commentBtn.innerHTML = "Post Comment";
}

function addComment(e) {
	e.preventDefault();
	if (nameField.value.trim() === '' || textField.value.trim() === '') {
		return;
	}

	commentBtn.disabled = true;
	commentBtn.innerHTML = "Posting...";
	xhr.open('POST', encodeURI('http://api.botleg.com/comment/'+window.location.pathname.split('/')[2]));
	xhr.setRequestHeader('Content-Type', 'application/json');
	xhr.onload = function() {
		if (xhr.status === 200) {
			if (xhr.responseText) {
				add();
			}
		}
	};
	xhr.send(JSON.stringify({
		name: nameField.value,
		text: textField.value
	}));
}

comments.innerHTML = '<span class="text">Loading comments...</span>';

xhr.open('GET', encodeURI('http://api.botleg.com/comment/'+window.location.pathname.split('/')[2]));
xhr.onload = function() {
	if (xhr.status === 200) {
		render(JSON.parse(xhr.responseText));
	}
};
xhr.send();

if(searchbox.addEventListener){
	searchbox.addEventListener("submit", search, false);
	newComment.addEventListener("submit", addComment, false);
} else if(searchbox.attachEvent){
	searchbox.attachEvent('onsubmit', search);
	newComment.attachEvent('onsubmit', addComment);
}