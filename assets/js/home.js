function search(e){e.preventDefault(),""!==document.getElementById("searchbox").value.trim()&&(window.location.href="/search/#"+document.getElementById("searchbox").value.trim().split(" ").join("+"))}var ele=document.getElementById("searchform");ele.addEventListener?ele.addEventListener("submit",search,!1):ele.attachEvent&&ele.attachEvent("onsubmit",search);