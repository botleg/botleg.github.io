---
summary: Improve the styling of line numbers in the code blocks of a Jekyll blog
title: Line numbers in Jekyll code blocks
layout: post
categories: jekyll
bg: "background:#ff5858;background: -webkit-linear-gradient(90deg, #f857a6 10%, #ff5858 90%);background:-moz-linear-gradient(90deg, #f857a6 10%, #ff5858 90%);background:-ms-linear-gradient(90deg, #f857a6 10%, #ff5858 90%);background:-o-linear-gradient(90deg, #f857a6 10%, #ff5858 90%);background:linear-gradient(90deg, #f857a6 10%, #ff5858 90%);"
date:   2015-09-27 11:00:00
tags: highlight
---
One of the really cool feature of a [Jekyll](built in support for syntax highlighting) blog generator is the in-built support for syntax highlighting in code blocks. The styling of the code blocks is really good with the default settings except for one thing, line numbers. In this article, we are going to fix just that.

The Problem
-----------
An ordinary code block without line numbers can be made by surrounding your code between `highlight` liquid tag. You can also specify the language of the code block as follows.
{% highlight text %}
{% raw %}
{% highlight language %}
//  YOUR CODE HERE
{% endhighlight %}
{% endraw %}
{% endhighlight %}

The code block created will look something like this.
{% highlight javascript %}
var http = require('http');

function handleRequest(request, response) {
  response.end(`Web server running on Node.js v${process.versions.node}.`);
}

var server = http.createServer(handleRequest);
server.listen(8000);
{% endhighlight %}

To add line numbers to this code block. Just add the keyword `linenos` to the highlight tag. If the language of the code is `javascript`, the liquid tag will look like this.
{% highlight text %}
{% raw %}
{% highlight javascript linenos %}
//  YOUR CODE HERE
{% endhighlight %}
{% endraw %}
{% endhighlight %}

After adding the line numbers, the code block will look something like this.
![Code Block with line numbers](/assets/images/code-lines.png){: .center-image }
*Code Block with line numbers*{: .image-caption }

This is pretty bad. The line numbers and the code does not have any division and the colour of the line numbers confuses it with the code. Also, when we select the code, the line numbers are also selected.

The Tweaks
----------
We can fix the above problems with a couple of tweaks. We can modify the looks of the line numbers by changing the property of the class `.lineno`. We add this class to the `_syntax-highlighting.scss` file in our Jekyll project.

First of all, we will change its colour to something more subtle. Then we add some padding and border.
{% highlight css %}
.lineno { 
  color: #ccc; 
  display: inline-block; 
  padding: 0 5px; 
  border-right:1px solid #ccc;
}
{% endhighlight %}

To prevent the line numbers from being selected when we select the code block, we need to set the `user-select` property of `.lineno`. With vendor prefixes, it looks like this.
{% highlight css %}
.lineno { 
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
{% endhighlight %}

The `.linenos` class in `_syntax-highlighting.scss` will now look like this.
{% highlight css %}
.lineno { 
  color: #ccc; 
  display:inline-block; 
  padding: 0 5px; 
  border-right:1px solid #ccc;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
{% endhighlight %}

Conclusion
----------
By tweaking the `.lineno` class, we can add better looking line numbers in Jekyll code blocks. You can also prevent the line numbers from being selected while selecting the code.