---
summary: Three ways to share your localhost and demo local development
title: Share your localhost
layout: post
categories: misc
bg: "background:#4776E6;background:-webkit-linear-gradient(to left,#4776E6,#8E54E9);background:linear-gradient(to left,#4776E6 ,#8E54E9);"
date:   2015-12-05 23:00:00
tags: SSH localhost 0.0.0.0 django node.js express listen 127.0.0.1 remote port forward ngrok tunnel
---
A lot of times, we would have to demo our local web development to our teammates, clients, etc. We could deploy the project in the cloud and share its address. These projects generally reside in our `localhost`, so it is much easier to make it publicly accessible. In this article, we will go through 3 ways to make a port in localhost available to everyone.

0.0.0.0
-------
For local development, you would have the web server listening to a port in localhost. This `127.0.0.1` is the local loop-back address. Any requests made to this IP is send back to yourself, so a server in this IP can only be available to you.

For making it available to others, you can change this IP to `0.0.0.0`. You can easily do this in all web frameworks. In Django, run the command below to set the IP to `0.0.0.0` and port to `8000`.
{% highlight python %}
python manage.py runserver 0.0.0.0:8000
{% endhighlight %}

For Node.js and Express framework, you can do this.
{% highlight javascript %}
app.listen(8000, "0.0.0.0");
{% endhighlight %}

What `0.0.0.0` does is that, it refers to all IPv4 addresses in your local system. So, the server is listening for calls in all the IPs assigned to your system. To find all IPs in the system, use the bash command,
{% highlight bash %}
$ hostname -I
{% endhighlight %}

You might get private IP address (starting with 10. or 192.168. or 172.16. to 172.31.) or public IP address or both. The private address is available for everyone in the local network and public address is available for everyone. So if your IP is `10.12.1.15`, anybody in your local network can access the server at `10.12.1.15:8000`.

SSH Remote Port Forward
-----------------------
In the previous [article](/stories/tricks-with-ssh/), we had discussed local port forwarding with SSH. For our purpose here, we use the opposite, i.e. remote port forward. This allows you to forward a port in your local system to a remote host. So, all requests comming to the given port in the remote host will be forwarded to our port in the local system. This works when you have an SSH server that has an publicly accessible IP.

The command to do this is,
{% highlight bash %}
$ ssh -R 4125:localhost:8000 user@host -N
{% endhighlight %}

`-R` flag is for remote port forwarding. Here, we are forwarding the port `8000` in our local system to port `4125` in the remote SSH host. We have to give the `user` and `host` of the SSH login next. `-N` flag is to prevent the SSH shell from opening up. You can terminate this with `Ctrl + C`. If the public IP of the SSH remote host is `101.20.30.22`, you can now access the server at `101.20.30.22:4125`.

One thing to note is that, remote port forwarding in SSH is turned off by default. You can turn it on by adding the following line to `/etc/ssh/sshd_config`,
{% highlight bash %}
GatewayPorts yes
{% endhighlight %}

Now restart the SSH service with,
{% highlight bash %}
$ sudo service ssh restart
{% endhighlight %}

ngrok
-----
If you don't have a public IP or access to a SSH server that has a public IP, you need to use some third-party application. The best one for this is [ngrok](https://ngrok.com/). It is used to create secure tunnel to your localhost.

Download ngrok 2.0 from [here](https://ngrok.com/download) and unzip it. Then run the following command.
{% highlight bash %}
$ ./ngrok http 8000
{% endhighlight %}
This generates a `ngrok.io` subdomain, that will tunnel to your port 8000. You application can be found at this address. It supports HTTPS. The paid version of the application also allows you to set up custom subdomains.

Conclusion
----------
We have now covered three ways to demo your local application without deploying hassles. Use either `0.0.0.0` IP address, SSH remote port forwarding or ngrok as needed.