var ele=document.getElementById("searchform");function search(a){a.preventDefault();""!==document.getElementById("searchbox").value.trim()&&(window.location.href="/search/#"+document.getElementById("searchbox").value.trim().split(" ").join("+"))}ele.addEventListener?ele.addEventListener("submit",search,!1):ele.attachEvent&&ele.attachEvent("onsubmit",search);