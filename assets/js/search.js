function render(e){list.innerHTML="";for(var t=0;t<e.length;t++)list.innerHTML+='<li><a class="post-link" href="/stories/'+e[t].id+'">'+e[t].title+"</a><p>"+e[t].summary+"</p></li>"}function updatePaging(){cPage>1?(prevAct.style.display="block",prevText.style.display="none"):(prevAct.style.display="none",prevText.style.display="block"),tPage>cPage?(nextAct.style.display="block",nextText.style.display="none"):(nextAct.style.display="none",nextText.style.display="block")}function loadPage(){list.innerHTML='<span class="text">Loading results...</span>',xhr.open("GET",encodeURI("http://api.botleg.com/search/"+query+"/"+cPage)),xhr.onload=function(){200===xhr.status&&render(JSON.parse(xhr.responseText).results)},xhr.send()}function nextPage(e){e.preventDefault(),cPage++,loadPage(),updatePaging()}function prevPage(e){e.preventDefault(),cPage--,loadPage(),updatePaging()}function showResult(e){return e.total?(render(e.results),tPage=Math.floor((e.total-1)/10+1),void(tPage>1&&(updatePaging(),pagination.style.display="block"))):void(list.innerHTML='<span class="text">Sorry, No results.</span>')}function search(){span.innerHTML=query.split("+").join(" "),location.hash=query,pagination.style.display="none",cPage=1,list.innerHTML='<span class="text">Loading results...</span>',xhr.open("GET",encodeURI("http://api.botleg.com/search/"+query)),xhr.onload=function(){200===xhr.status&&showResult(JSON.parse(xhr.responseText))},xhr.send()}function searchFrm(e){e.preventDefault(),""!==box.value.trim()&&(query=box.value.trim().split(" ").join("+"),search())}var form=document.getElementById("searchform"),box=document.getElementById("searchbox"),span=document.getElementById("query"),list=document.getElementById("search-list"),pagination=document.getElementById("pagination"),prevAct=document.getElementById("prevAct"),prevText=document.getElementById("prevText"),nextAct=document.getElementById("nextAct"),nextText=document.getElementById("nextText"),query=location.hash.slice(1),xhr=new XMLHttpRequest,cPage=1,tPage;pagination.style.display="none",box.value=span.innerHTML=query.split("+").join(" "),search(),form.addEventListener?(form.addEventListener("submit",searchFrm,!1),nextAct.addEventListener("click",nextPage,!1),prevAct.addEventListener("click",prevPage,!1)):form.attachEvent&&(form.attachEvent("onsubmit",searchFrm),nextAct.attachEvent("onclick",nextPage),prevAct.attachEvent("onclick",prevPage));