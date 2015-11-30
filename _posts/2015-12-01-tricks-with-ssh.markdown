---
summary: Couple of SSH techniques that saved me a lot of time and helped me with tricky situations.
title: Tricks with SSH
layout: post
categories: misc
bg: "background:#3CA55C;background:-webkit-linear-gradient(to left, #3CA55C , #B5AC49);background:linear-gradient(to left, #3CA55C , #B5AC49);"
date:   2015-12-1 1:00:00
tags: SSH secure shell config remote local port ip alias forward
---
Almost all developers have some sort of experience working with `Secure Shell` or `SSH`. It allows you to connect to a remote location and communicate securely. In this article, I'll share couple of tips that will make working with SSH easier.

SSH Config
----------
The basic way of connecting to a remote server is,
{% highlight bash %}
ssh user@ip -p 22
{% endhighlight %}
It is not easy to remember a bunch of ip addresses and type those in everytime you want to connect to a remote server. SSH allows you to give alias to each connection configuration including hostname, username, port, etc. This is done with `SSH Config`.

Add a new file, `~/.ssh/config`. For each connection, add this block to the config file we just created.
{% highlight bash %}
  Host <alias>
    HostName <host-address>
    Port <port>
    User <username>
    IdentityFile <public-key-file>
{% endhighlight %}
The `IdentityFile` field is optional, and it contains the path of the public key used for identity. An example of this block is given below.
{% highlight bash %}
  Host myremote
    HostName 101.102.103.104
    Port 22
    User root
    IdentityFile ~/.ssh/id_rsa.pub
{% endhighlight %}
We can log into this remote server with the command,
{% highlight bash %}
ssh myremote
{% endhighlight %}
If you have copied your key to remote as an authorized key with `ssh-copy-id`, you will be connected to the remote server. Even tab completion works for the alias names. Pretty convenient, right?

Local Port Forward
------------------
SSH can be used to forward ports from a remote server to local system and vice-versa. Now, we'll talk only about the former, also called local port forwarding. It is generally used to access blocked websites in a network. You can forward any of your local ports to a blocked site, and access it with the assigned local port.

For instance, you can forward your local port 5000 to [YouTube](http://youtube.com) with,
{% highlight bash %}
ssh -L 5000:youtube.com:80 user@host
{% endhighlight %}
Now, you can access YouTube at [localhost:5000](http://localhost:5000).

There are a couple of other use cases for local port forwarding. The main one is to access services for local development. Most database in the network will only allow access to localhost and remote access will be blocked by the firewall. While it's good for security, it would make the database inaccessible for local development.

We can use local port forwarding to solve this issue. Let's assume, I've a [Redis](http://redis.io/) database running in `120.10.20.30:16379`. If I have SSH access to this remote server, I can forward the remote port `16379` to any of my local port.
{% highlight bash %}
ssh -L 0.0.0.0:5866:120.10.20.30:16379 user@host -Nf
{% endhighlight %} 
We will go through all the different things in this command. The `-L` flag for the SSH command tells that it's a local port forward command.

The basic format of local port forward is,
{% highlight bash %}
<local-ip>:<local-port>:<remote-ip>:<remote-port>
{% endhighlight %}
Here, the local ip is `0.0.0.0`. What it does is that, it listens to all hosts in the network. So, any host in your network can access the Redis database with your ip. The local port is `5866`. If your local ip address is `10.18.0.13`, then Redis database can be accessed by anybody in your network at `10.18.0.13:5866` and for you, it's `localhost:5866`. If your avoid the `local-ip` part, only you can access the database.

The `remote-port` and `remote-ip` is that of the service, we need to forward. In the case, we are forwarding the database in `120.10.20.30:16379`. Now we need to provide the user and host of the remote SSH login. As discussed above, we can replace this with an alias in SSH config.

There are two more flags in the command and these are very important. `-N` flag asks the SSH to NOT execute the remote command. This prevents the remote shell from coming up. '-f' flag makes the SSH to go into the background and excute the command like a daemon. Together, we can the flag `-Nf`.

Conclusion
----------
In this article, I've shared two SSH techniques that saved me a lot of time and helped me with tricky situations. The first one involves using a config file for SSH and other one involves local port forwarding.