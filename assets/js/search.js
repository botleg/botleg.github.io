function searchFrm(e){e.preventDefault(),""!==box.value.trim()&&search(box.value.trim().split(" ").join("+"))}function search(e){span.innerHTML=e.split("+").join(" ")}var form=document.getElementById("searchform"),box=document.getElementById("searchbox"),span=document.getElementById("query"),query=location.hash.slice(1);box.value=span.innerHTML=query.split("+").join(" "),search(query),form.addEventListener?form.addEventListener("submit",searchFrm,!1):form.attachEvent&&form.attachEvent("onsubmit",searchFrm);var xhr=new XMLHttpRequest;xhr.open("GET",encodeURI("http://api.botleg.com/search/"+query)),xhr.onload=function(){200===xhr.status&&console.log(JSON.parse(xhr.responseText))},xhr.send();