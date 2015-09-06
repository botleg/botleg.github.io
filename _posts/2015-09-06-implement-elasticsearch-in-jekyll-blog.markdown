---
summary: Elasticsearch is a database used for full-text searching and Jekyll is a static blog generator. In this article, we will see how to implement Elasticsearch based searching to a Jekyll blog.
title: Implement Elasticsearch in Jekyll blog
layout: post
gh: https://github.com/botleg/elasticsearch-jekyll/
demo: http://elastic.jekyll.botleg.com/
categories: jekyll
tags: elasticsearch appbase.io lucene github-pages node.js koa openshift webhooks javascript markdown ajax
date:   2015-09-06 11:00:00
bg: "background:#f46b45;background:-webkit-linear-gradient(90deg, #f46b45 10%, #eea849 90%);background:-moz-linear-gradient(90deg, #f46b45 10%, #eea849 90%);background:-ms-linear-gradient(90deg, #f46b45 10%, #eea849 90%);background:-o-linear-gradient(90deg, #f46b45 10%, #eea849 90%);background:linear-gradient(90deg, #f46b45 10%, #eea849 90%);"
---
[Elasticsearch](https://www.elastic.co/products/elasticsearch) is a database based on Apache Lucene and it supports distributed full-text searching and provides a RESTful API. [Jekyll](http://jekyllrb.com) is a static site generator used mainly as blog generator. We can use Elasticsearch to index the blog posts and it can then be searched efficently. In this article, we will see how to implement Elasticsearch based searching to a Jekyll blog. You will need to know the basics of Jekyll and Node.js, or any other language to create an web API backend.

The working demo for this article is hosted [here](http://elastic.jekyll.botleg.com/) and the code for this can be found [here](https://github.com/botleg/elasticsearch-jekyll/). The repository contains two branches, a `master` branch which has an web API made using Node.js which handles the communication with Elasticsearch server and a `gh-pages` branch which contains our blog made using Jekyll. 

The Jekyll blog is hosted using `GitHub Pages`, which is used to host static or Jekyll generated sites for free. For any repository, you can add an orphan branch named `gh-pages` and it will be hosted by `GitHub Pages`. You can read more about this [here](https://help.github.com/articles/using-jekyll-with-pages/).

##Appbase.io
[Appbase.io](https://appbase.io/) is a Database as a service solution that provides hosted Elasticsearch endpoints. The free plan includes 100MB storage and 100K API calls per month at the time of writing. It would suffice for testing purposes. Go ahead, sign up there and create an application. You can get the username and password for your application from the dashboard by clicking Credentials.

{% include image.html img="/assets/images/appbase-dash.jpg" title="Appbase.io Dashboard" caption="Appbase.io Dashboard" %}

##Node.js Backend
We will start with the backend API that handles all communication with Elasticsearch and gives us the search results for the front-end. It uses [Koa](http://koajs.com/) web framework, which is a really good framework for developing API with Node.js and it supports Javascript ES6, so you should have atleast `v0.11` of Node.js and use the `--harmony` flag. You can see the entire code for this backend [here](https://github.com/botleg/elasticsearch-jekyll/tree/master).

It is hosted with [OpenShift](https://www.openshift.com/) which provide 3 `gears` for free. You can host this application in one of those gears. The `.openshift` folder is the repository contains scripts to update Node.js from v0.10, which is default in OpenShift, to v0.12.4. You can find information about this [here](https://github.com/ryanj/nodejs-custom-version-openshift).

The entry point of the application will be called `index.js` and we will have the file `config.js`, for storing the configuration and `route.js`, for handling Koa routes.

`config.js` contains the appbase.io and openshift configurations. You can hard code the values or use environment variables. Values for `ip` and `port` allows us to test it in local system and to host it in OpenShift. The `baseurl` parameter is required for us to get the raw data of the files in the Jekyll repository. You can obtain it by replacing your github personal or organization name, repository name and branch name in `https://raw.githubusercontent.com/{your-id-here}/{your-repo-name-here}/{your-branch-name-here}/`. The search object in the `search` object in `config.js` is used as search options for Elasticsearch API. More about these options can be found [here](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html#api-search). Feel free to play with these options till the search results become correct for you. The complete code for `config.js` is given below.
{% highlight javascript   %}
module.exports = {
  ip: process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1',
  port: process.env.OPENSHIFT_NODEJS_PORT || 8000,
  baseurl: 'https://raw.githubusercontent.com/{your-id-here}/{your-repo-name-here}/{your-branch-name-here}/',
  hostname: 'scalr.api.appbase.io',
  appname: '',  // appbase.io application name here
  username: '', // appbase.io application username here
  password: '', // appbase.io application password here
  collection: 'posts',

  search: {
    query: {
      multi_match: {
        type: 'best_fields',
        fuzziness: 'AUTO',
        tie_breaker: 0.3,
        fields: ['title', 'text']
      }
    },
    _source: ['title', 'summary']
  }
};
{% endhighlight %}

In `index.js`, we create a Elasticsearch client with out configurations.
{% highlight javascript %}
var client = new elasticsearch.Client({
  host: 'https://'+config.username+":"+config.password+"@"+config.hostname,
});
{% endhighlight %}

We also setup Koa in `index.js`. It's complete code is given below.
{% highlight javascript %}
var app = require('koa')(),
    elasticsearch = require('elasticsearch'),
    config = require('./config');

var client = new elasticsearch.Client({
  host: 'https://'+config.username+":"+config.password+"@"+config.hostname,
});

var router = require('./route.js')(client, config);

app.use(function *(next){
  var start = new Date();
  yield next;
  var ms = new Date() - start;
  this.set('X-Response-Time', ms + 'ms');
});

app.use(function *(next){
  var start = new Date();
  yield next;
  var ms = new Date() - start;
  console.log('%s %s - %s', this.method, this.url, ms);
});

app.use(router.routes())
  .use(router.allowedMethods());

app.listen(config.port, config.ip);
{% endhighlight %}


The magic happens in the `route.js` file. We will start with basic imports. The router objects accepts both Elasticsearch client and configurations object as the parameters. We also create two routes, one returns null and one returns the number of records in the Elasticsearch index.
{% highlight javascript %}
var router = require('koa-router')(),
    koaBody = require('koa-body')(),
    request = require('co-request');

module.exports = function(client, config) {
  router.get('/', function*(next) {
    this.body = null;
  });

  router.get('/count', function*(next) {
    this.body = yield client.count({
      index: config.appname
    });
  });

  return router;
};
{% endhighlight %}

Now, the real problem involved in implementing Elasticsearch with a Jekyll blog is how we index the posts in Elasticsearch. This must happen automatically, so I used [GitHub Webhooks](https://developer.github.com/webhooks/). Every time I push a commit to the Jekyll repository, GitHub will send a `POST` request containing a JSON payload with the changes to the url I specify. I will handle that request with this app where I add, edit or delete records in my Elasticsearch index based on the file changes. We will use the route `/commit` for this. An example JSON payload for the push event can be found [here](https://developer.github.com/v3/activity/events/types/#pushevent).

Our Elasticsearch index will be the appbase.io appname and type will be called `posts`. The `_id` field for the record will be the posts's filename without the date and extension. There will be 3 fields for each posts, `title` with the post title, `summary` with post summary and `text` with raw contents of the post. We will search in the `title` and `text` fields. 

We will go through each commit in the push event payload. We need to look for three events: add, edit and delete. If a new file is added in the commit, it will be there in `added` object inside the `commit` object. As the posts for a Jekyll blog are inside `_posts` folder, we need check whether `_posts` is there in the file path. If it is there, we will add a new entry to our Elasticsearch index with `id` by removing `_posts`, date and extension from the file path. If `add` is the file path, we can get that with,
{% highlight javascript %}
add.substring(18, add.length - 9)
{% endhighlight %}

The raw data of the file is requested with,
{% highlight javascript %}
var text = yield request(config.baseurl + add)
{% endhighlight %}

We take the summary and title of the new entry from the second and third line of the markdown respectively. This is based on how we write the front-matter in the Jekyll posts. We will get to that later. This can be done with,
{% highlight javascript %}
body: {
  title: text.body.split('\n')[2].slice(7),
  summary: text.body.split('\n')[1].slice(9),
  text: text.body,
  comments: []
}
{% endhighlight %}
The `slice` functions are used above to remove the word `title` from the title itself and so on.

Now, we have seen how to handle the post addition. Similar procedure is done for deletion and modification of the posts. The complete code for `/commit` route can be seen here.
{% highlight javascript %}
router.post('/commit', koaBody, function*(next) {
  if (typeof this.request.body.commits !== 'undefined') {
    for (var commit of this.request.body.commits) {
      for (var add of commit.added) {
        if (add.indexOf('_posts/') > -1) {
          var text = yield request(config.baseurl + add);
          yield client.index({
            index: config.appname,
            type: config.collection,
            id: add.substring(18, add.length - 9),
            body: {
              title: text.body.split('\n')[2].slice(7),
              summary: text.body.split('\n')[1].slice(9),
              text: text.body,
              comments: []
            }
          });
        }
      }

      for (var add of commit.removed) {
        if (add.indexOf('_posts/') > -1) {
          yield client.delete({
            index: config.appname,
            type: config.collection,
            id: add.substring(18, add.length - 9)
          });
        }
      }

      for (var add of commit.modified) {
        if (add.indexOf('_posts/') > -1) {
          var text = yield request(config.baseurl + add);
          yield client.update({
            index: config.appname,
            type: config.collection,
            id: add.substring(18, add.length - 9),
            body: {
              doc: {
                title: text.body.split('\n')[2].slice(7),
                text: text.body,
                summary: text.body.split('\n')[1].slice(9)
              }
            }
          });
        }
      }
    }
  }
  this.body = true;
});
{% endhighlight %}

Now that we have the indexing ready, we can add the search route. We use the search object in `config.js` as search option and use request parameter as the query. We use the Elasticsearch client to search and we list of the search results with the id, title and summary fields. We will also provide the required headers. The `search/:q` route is given below.
{% highlight javascript %}
router.get('/search/:q', function*(next) {
  config.search.query.multi_match.query = this.params.q;
  var result = [];

  var state = yield client.search({
    index: config.appname,
    body: config.search
  });

  for (var item of state.hits.hits) {
    item._source.id = item._id;
    result.push(item._source);
  }

  this.set('Access-Control-Allow-Origin', '*');
  this.set('Cache-Control', 'max-age=3600');
  this.type = 'application/json';
  this.body = result;
});
{% endhighlight %}

That's all there is for `route.js` and its complete code is given below.
{% highlight javascript %}
var router = require('koa-router')(),
    koaBody = require('koa-body')(),
    request = require('co-request');

module.exports = function(client, config) {
  router.get('/', function*(next) {
    this.body = null;
  });

  router.get('/count', function*(next) {
    this.body = yield client.count({
      index: config.appname
    });
  });

  router.get('/search/:q', function*(next) {
    config.search.query.multi_match.query = this.params.q;
    var result = [];

    var state = yield client.search({
      index: config.appname,
      body: config.search
    });

    for (var item of state.hits.hits) {
      item._source.id = item._id;
      result.push(item._source);
    }

    this.set('Access-Control-Allow-Origin', '*');
    this.set('Cache-Control', 'max-age=3600');
    this.type = 'application/json';
    this.body = result;
  });

  router.post('/commit', koaBody, function*(next) {
    if (typeof this.request.body.commits !== 'undefined') {
      for (var commit of this.request.body.commits) {
        for (var add of commit.added) {
          if (add.indexOf('_posts/') > -1) {
            var text = yield request(config.baseurl + add);
            yield client.index({
              index: config.appname,
              type: config.collection,
              id: add.substring(18, add.length - 9),
              body: {
                title: text.body.split('\n')[2].slice(7),
                summary: text.body.split('\n')[1].slice(9),
                text: text.body,
                comments: []
              }
            });
          }
        }

        for (var add of commit.removed) {
          if (add.indexOf('_posts/') > -1) {
            yield client.delete({
              index: config.appname,
              type: config.collection,
              id: add.substring(18, add.length - 9)
            });
          }
        }

        for (var add of commit.modified) {
          if (add.indexOf('_posts/') > -1) {
            var text = yield request(config.baseurl + add);
            yield client.update({
              index: config.appname,
              type: config.collection,
              id: add.substring(18, add.length - 9),
              body: {
                doc: {
                  title: text.body.split('\n')[2].slice(7),
                  text: text.body,
                  summary: text.body.split('\n')[1].slice(9)
                }
              }
            });
          }
        }
      }
    }
    this.body = true;
  });

  return router;
};
{% endhighlight %}

We have completed the backend now and it's ready for hosting. Again, the complete code for these files can be found [here](https://github.com/botleg/elasticsearch-jekyll/tree/master).

##Jekyll Fontend
Before we start with Jekyll, create a branch `gh-pages` in Github and add a webhook to `/commit` route of the back-end app. Check this [link](https://developer.github.com/webhooks/) for more about GitHub Webhooks.

Create a new orphan branch and create a basic Jekyll blog with the following commands,
{% highlight bash %}
git checkout --orphan gh-pages
git rm -rf .
gem install jekyll
jekyll new . -f
{% endhighlight %}

Once this blog is scaffolded by Jekyll, we can put some dummy posts for test purpose. The front-matter the blog must be in the given format itself. The second line contains `summary:` followed by a single space and the post summary. The third line contains `title:` followed by a single space and the post title. The rest can be in any order and format. This is done as we are taking the summary and title for the Elasticsearch index from the second and third line of the front-matter respectively. The front-matter of a post can look like this.
{% highlight javascript %}
---
summary: Far far away, behind the word mountains, far from the countries Vokalia and Consonantia, there live the blind texts
title: Far Far Away
layout: post
date:   2015-08-01 18:23:42
categories: jekyll update
---
{% endhighlight %}

To add search box and button to all pages, we add the following to `_includes/header.html`. The styling is up to you.
{% highlight html %}
<form class="search" id="searchform">
  <input type="text" class="searchbox" id="searchbox" />
  <input type="submit" value="Search">
</form>
{% endhighlight %}

We also need a page to show the search results. So, add a new page `search/index.html` with the following contents,
{% highlight html %}
---
layout: default
type: search
---

<div class="home">
  
  <h1 class="page-heading">Search results for '<span id="query"></span>'</h1>

  <ul class="post-list" id="post-list">
    {{ "{% for post in site.posts " }}%}
      <li>
        <span class="post-meta">{{ "{{ post.date | date: '%b %-d, %Y' " }}}}</span>

        <h2><a class="post-link" href="{{ "{{ post.url | prepend: site.baseurl " }}}}">{{ "{{ post.title " }}}}</a></h2>
        <p>{{ "{{ post.summary " }}}}</p>
      </li>
    {{ "{% endfor " }}%}
  </ul>

</div>
{% endhighlight %}

Most of the work here is done in javascript, let's create two javascript files in the folder `js` folder. We create `search.js` for the search page and `home.js` for all other pages. To attach these javascript files to the corresponding files, add the following to the end of `_includes/footer.html`,
{% highlight html %}
{{ "{% if page.type == 'search' " }}%}
  <script src="/js/search.js" type="text/javascript"></script>
{{ "{% else " }}%}
  <script src="/js/home.js" type="text/javascript"></script>
{{ "{% endif " }}%}
{% endhighlight %}

In `home.js`, we need to handle the search form submit. Once form is submitted with something in the searchbox, we can send then to `/search#query`, where `query` is the searched query. So, `home.js` will be as below. So if the webpage is `botleg.com` and `query` is `test`, the resulting page will be `botleg.com/search/#test`
{% highlight javascript %}
var form = document.getElementById('searchform');

function search(e) {
  e.preventDefault();
  if (document.getElementById('searchbox').value.trim() !== '') {
    window.location.href = '/search/#' + document.getElementById('searchbox').value.trim().split(' ').join('+');
  }
}

if (form.addEventListener) {
  form.addEventListener("submit", search, false);
} else if (form.attachEvent) {
  form.attachEvent('onsubmit', search);
}
{% endhighlight %}

In `search.js`, we can read the search query with,
{% highlight javascript %}
location.hash.slice(1)
{% endhighlight %}

We will send a `GET` request to the `/search/:q` with AJAX, where `:q` is replaced by the search query and its response contains the search results. These are then injected into the web page. You can search for another query and a new request will be sent. Complete code for `search.js` is given below.
{% highlight javascript %}
var form = document.getElementById('searchform'),
    box = document.getElementById('searchbox'),
    span = document.getElementById('query'),
    list = document.getElementById('post-list'),
    query = location.hash.slice(1),
    xhr = new XMLHttpRequest();

function render(results) {
  if (!results.length) {
    list.innerHTML = '<span class="text">Sorry, No results.</span>';
    return;
  }

  list.innerHTML = "";
  for (var i = 0; i < results.length; i++) {
    list.innerHTML += '<li><a class="post-link" href="/posts/' + results[i].id + '">' + results[i].title + '</a><p>' + results[i].summary + '</p></li>';
  }
}

function search() {
  span.innerHTML = query.split('+').join(' ');
  location.hash = query;
  list.innerHTML = '<span class="text">Loading results...</span>';

  xhr.open('GET', encodeURI('http://elastic.api.botleg.com/search/' + query));
  xhr.onload = function() {
    if (xhr.status === 200) {
      render(JSON.parse(xhr.responseText));
    }
  };
  xhr.send();
}

function searchFrm(e) {
  e.preventDefault();
  if (box.value.trim() !== '') {
    query = box.value.trim().split(' ').join('+');
    search();
  }
}

box.value = span.innerHTML = query.split('+').join(' ');
search();

if (form.addEventListener) {
  form.addEventListener("submit", searchFrm, false);
} else if (form.attachEvent) {
  form.attachEvent('onsubmit', searchFrm);
}
{% endhighlight %}
That's all there is. Once you push your changes to GitHub, the posts will be indexed by Elasticsearch and these can then be searched. The code for the Jekyll Frontend can be found [here](https://github.com/botleg/elasticsearch-jekyll/tree/gh-pages).

##TL;DR
The working demo for this article is hosted [here](http://elastic.jekyll.botleg.com/) and the code for this can be found [here](https://github.com/botleg/elasticsearch-jekyll/). We can create an Elasticsearch endpoint using [appbase.io](https://appbase.io/). Then we need a web API backend to handle Webhooks. From Webhooks, we can get the information about file changes in Jekyll repository which can then used to index these posts with Elasticsearch. Once these are indexed, we can use AJAX requests to Elasticsearch and show search results by injecting it into webpage. And that's one way to implement Elasticsearch in a Jekyll Blog.