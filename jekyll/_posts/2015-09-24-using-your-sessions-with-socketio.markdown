---
summary: Use our site's sessions for authentication with Socket.IO. When a user opens the chat application, he gets a session with a random username. This is required by Socket.IO for authentication and identification. 
title: Using your sessions with Socket.IO
layout: post
gh: https://github.com/botleg/socketio-sessions
demo: http://socketio.sessions.botleg.com/
categories: Node.js
bg: "background:#185a9d;background: -webkit-linear-gradient(90deg, #43cea2 10%, #185a9d 90%);background:-moz-linear-gradient(90deg, #43cea2 10%, #185a9d 90%);background:-ms-linear-gradient(90deg, #43cea2 10%, #185a9d 90%);background:-o-linear-gradient(90deg, #43cea2 10%, #185a9d 90%);background:linear-gradient(90deg, #43cea2 10%, #185a9d 90%);"
date:   2015-09-24 22:00:00
tags: socket.io session koa cookie web-sockets
---
> Socket.IO enables real-time bidirectional event-based communication.

[Socket.IO](http://socket.io/) uses web sockets for communication between the Node.js server and its clients. If client emits an event with some data, server can listen to it and use the data, and vice versa. The server can also broadcast events to all clients. In this article, we will see how to use our site's sessions for authentication with Socket.IO.

The entire code for the application can be found [here](https://github.com/botleg/socketio-sessions) and the working demo is deployed [here](http://socketio.sessions.botleg.com/). We have a small chat application. When a new user opens the application, he gets a session with a random number as his `user id`. This is required by Socket.IO for authentication.

The Basic App
-------------
We start with a simple chat application made in Node.js with [Koa](http://koajs.com/) web framework. The code at this point can be found at the `before-session` tag of the code repository [here](https://github.com/botleg/socketio-sessions/tree/before-session).

The server file, `index.js` creates a Koa server and serves a static folder `public` which contains a HTML page and a javascript file. It then connects this server to Socket.IO. The code looks like this.
{% highlight javascript %}
var app = require('koa')(),
    serve = require('koa-static');

const PORT = 8000;
const IP = '127.0.0.1';

app.use(serve('./public'));

var server = require('http').Server(app.callback()),
    io = require('socket.io')(server);

io.on('connection', function(socket) {
  socket.on('send chat', function (data) {
    io.emit('new chat', data);
  });
});

server.listen(PORT, IP);
{% endhighlight %}

The client, `public/app.js` connects to Socket.IO and sends the chat message to server by emitting `send chat` event and listens for `new chat` event for any new messages from other users. Note that we are only sending the message to the server and nothing about the user.
{% highlight javascript %}
var socket = io.connect(),
    form = document.getElementById('chatForm'),
    msgBox = document.getElementById('msgBox'),
    chatBox = document.getElementById('chatBox');

socket.on('new chat', function (data) {
  chatBox.innerHTML = data.msg + '<hr/>' + chatBox.innerHTML;
});

function newMsg(e) {
  e.preventDefault();
  if (msgBox.value.trim() !== '') {
    socket.emit('send chat', { msg: msgBox.value.trim() });
    msgBox.value = '';
  }
}

if(form.addEventListener){
  form.addEventListener("submit", newMsg, false);
} else if(form.attachEvent){
  form.attachEvent('onsubmit', newMsg);
}
{% endhighlight %}

Adding Sessions
---------------
To add session authentication to Socket.IO, we only need to make the change in the server side code. That is the `index.js` file. First, we need to install two modules, `koa-session` and `cookie`.
{% highlight bash %}
npm install --save koa-session
npm install --save cookie
{% endhighlight %}

Require these from `index.js` page and set up `koa-session` with some secret key.
{% highlight javascript %}
var cookie = require('cookie'),
    serve = require('koa-static');

app.keys = ['my secret key'];
app.use(session(app));
{% endhighlight %}

Now, we'll create a session for all users with some random number as the username. However, we only need to create a new session if one doesn't already exist. This way, a user will have the same username even if he closes the app and reopens it. Also, we need to put all these middleware functions before serving the public folder.
{% highlight javascript %}
app.use(function *(next) {
  if (typeof this.session.name === 'undefined') {
    this.session.name = Math.round(Math.random() * 10000);
  }
  yield next;
});
{% endhighlight %}

`koa-session` will generate two cookies, `koa:sess` and `koa:sess.sig`. We are interested in `koa:sess`. It contains all the data we put in to the session and some default values in `base64 encoded` format. After decoding, it will contain something like this.
{% highlight json %}
{
  "name":1095,
  "_expire":1443197611494,
  "_maxAge":86400000
}
{% endhighlight %}

Now, we can get to Socket.IO authorization. You can define custom authorization for Socket.IO with this function.
{% highlight javascript %}
io.set("authorization", function(data, accept) {
  //FOR SUCCESS
  accept(null, true);

  //FOR FAILURE
  return accept('Error Message.', false);
});
{% endhighlight %}
Only if we send `accept(null, true);`, the web-socket handshake happens and we can communicate with it.

Here, we need to parse the cookies, which is available in `data.headers.cookie` to obtain `koa:sess` cookie. We then decode it and extract `name` from it. We will store this in `data.name`. We will only allow connections if the cookie exists with a `name`.
{% highlight javascript %}
io.set("authorization", function(data, accept) {
  if (data.headers.cookie && data.headers.cookie.indexOf('koa:sess') > -1) {
    data.cookie = cookie.parse(data.headers.cookie)['koa:sess'];
    data.name = JSON.parse(new Buffer(data.cookie, 'base64')).name;
  } else {
    return accept('No cookie transmitted.', false);
  }
  accept(null, true);
});
{% endhighlight %}

If you are using some sort of session store with a database. You can get the user data required by quering the database with the cookie.

Now, the `name` that we added to data object during authorization can be accessed from `socket.request.name`. So, we can modify the `send chat` event listener to include the user ID.
{% highlight javascript %}
socket.on('send chat', function(data) {
  data.msg = socket.request.name + ": " + data.msg;
  io.emit('new chat', data);
});
{% endhighlight %}

That's all we need to do to incorporate our sessions to Socket.IO. The complete server side code now looks like this.
{% highlight javascript %}
var app = require('koa')(),
    session = require('koa-session'),
    cookie = require('cookie'),
    serve = require('koa-static');

const PORT = 8000;
const IP = '127.0.0.1';

app.keys = ['my secret key'];
app.use(session(app));

app.use(function *(next) {
  if (typeof this.session.name === 'undefined') {
    this.session.name = Math.round(Math.random() * 10000);
  }
  yield next;
});

app.use(serve('./public'));

var server = require('http').Server(app.callback()),
    io = require('socket.io')(server);

io.set("authorization", function(data, accept) {
  if (data.headers.cookie && data.headers.cookie.indexOf('koa:sess') > -1) {
    data.cookie = cookie.parse(data.headers.cookie)['koa:sess'];
    data.name = JSON.parse(new Buffer(data.cookie, 'base64')).name;
  } else {
    return accept('No cookie transmitted.', false);
  }
  accept(null, true);
});

io.on('connection', function(socket) {
  socket.on('send chat', function(data) {
    data.msg = socket.request.name + ": " + data.msg;
    io.emit('new chat', data);
  });
});

server.listen(PORT, IP);
{% endhighlight %}

Conclusion
----------
In this article, we have seen how to use sessions to authenticate user while connecting to Socket.IO. This enables us to provide security for data communication with web sockets and store the user data persistently.