---
summary: With Let's Encrypt create SSL certificates free of cost to serve your site via HTTPS. Also, see how to automate the process of renewing these certificates.
title: HTTPS with Let's Encrypt and nginx
layout: post
categories: devops
bg: "background:rgb(241, 196, 15) 25%;background-image: linear-gradient(90deg, rgb(241, 196, 15) 25%, rgb(231, 76, 60) 100%);background-image: -moz-linear-gradient(left, rgb(241, 196, 15) 25%, rgb(231, 76, 60) 100%);background-image: -webkit-linear-gradient(left, rgb(241, 196, 15) 25%, rgb(231, 76, 60) 100%);background-image: -o-linear-gradient(left, rgb(241, 196, 15) 25%, rgb(231, 76, 60) 100%);background-image: -ms-linear-gradient(left, rgb(241, 196, 15) 25%, rgb(231, 76, 60) 100%);"
date:   2016-01-17 17:00:00
tags: https letsencrypt ssl tls certificate authority nginx git popular
---
HTTPS is a secure protocol for the internet. Unlike the communication in HTTP, which happens in plain-text, the data transferred between the server and the client with HTTPS is encrypted. HTTPS also verifies the identity of the website we are accessing with a `SSL/TLS` certificate. It was initially used in online payment website, but in the recent age of privacy, it is deemed mandatory. That's where [Let's Encrypt](https://letsencrypt.org/) comes in.

Let’s Encrypt is a `Certificate Authority`, they verify a website and issues certificates. The browsers have a list of trusted Certificate Authorities whose certificates it will accept. There are a lot of Certificate Authorities, so what make Let's Encrypt different?

Two main issues with SSL certificates was that, it was paid and the process is not generally automated. Let's Encrypt solves both these issues. Let's Encrypt issues certificates `free of cost` and it can be automated. You just need root terminal access to the server. It is currently in public beta and is backed by major players like Mozilla, Facebook, Google, etc. 

In this article, we will see how to create a certificate with Let's Encrypt and use it to host our server via HTTPS. We will be using an `nginx` server here but the process is similar to all servers.

Installing Let's Encrypt
------------------------
Use SSH to log into your server as `root` user. If you have `git` installed in the server, you can clone the Let's Encrypt repo in `/opt` folder.

{% highlight bash %}
cd /opt
git clone https://github.com/letsencrypt/letsencrypt
{% endhighlight %}

Otherwise, download the latest `tar.gz` package from `https://github.com/letsencrypt/letsencrypt/releases` with wget. Extract this to `/opt/` and rename the folder to `letsencrypt`. Latest version at the time of writing was `v0.2.0`, so the commands for this are.

{% highlight bash %}
wget https://github.com/letsencrypt/letsencrypt/archive/v0.2.0.tar.gz
tar xf v0.2.0.tar.gz -C /opt/
cd /opt
mv letsencrypt-0.2.0 letsencrypt
{% endhighlight %}

Now we have letsencrypt installed at `/opt/letsencrypt`. You can add this to `PATH`.

Let's Encrypt Configuration
---------------------------
Before you add SSL certificates, you need to register a domain and the domain must point to the server's public address. For this, you need to a set up a `A` or `CNAME` record with your DNS. You can check with your domain registar or custom DNS service to do this. If you have a HTTP site running in the server, you would have already done this.

Let's Encrypt need to verify that you own the domain before they provide you with the certificates. This can be done in various ways. If you are running `Apache` server, Let's Encrypt can use it to verify your ownership and even install the certificates in the server for you. There is also something similar for `nginx`, but it's still experimental and not production-ready. 

Another method is `standalone`, where the Let's Encrypt client will create a temporary webserver for verification. However, this need our `nginx` server to be shutdown while creating and renewing our certificates. That's just not viable. 

So we will go with the `webroot` method. In this method, we provide a folder path as `webroot-path`. This folder must be served by our server. A temporary file will be made inside `<webroot-path>/.well-known/acme-challenge/` by the client. Let's Encrypt will access it from the domain to verify the ownership.

For example, if the domain in `www.example.com` and the `webroot-path` is `/usr/share/nginx/html`. The client will create a temporary file named something like `1PnCIkY` inside `/usr/share/nginx/html/.well-known/acme-challenge/` and it will accessed from `www.example.com/.well-known/acme-challenge/1PnCIkY` for verification of the domain ownership.

The configuration needed to create the certificates are put in a file named `cli.ini` inside `/opt/letsencrypt`.

{% highlight conf %}
rsa-key-size = 4096
email = <your-email>
domains = <domains>
authenticator = webroot
webroot-path = /usr/share/nginx/html
{% endhighlight %}

You need to provide your email address for recovering the certificate credentials. Also add the domains for which you want the certificates for seperated by commas like, `example.com, www.example.com`.

Nginx
-----
We need to set up nginx to serve the `webroot-path` folder with nginx. If you have not installed `nginx` yet, install it with,

{% highlight bash %}
apt-get install nginx
{% endhighlight %}

Now, open the nginx configuration at `/etc/nginx/sites-available/default` and change it as following to serve `.well-known` folder.

{% highlight nginx %}
server {
  listen 80;
  server_name <domain-name>;
  
  root /usr/share/nginx/html;
  index index.html index.htm index.nginx-debian.html;

  location ^~ /.well-known/ {
    allow all;
  }
}
{% endhighlight %}

Create Certificate
------------------
Finally, we are ready to create our first certificate. Execute the following commands.

{% highlight bash %}
cd /opt/letsencrypt
./letsencrypt-auto certonly --agree-tos --config cli.ini
{% endhighlight %}

The `certonly` parameter creates the certificate. `--agree-tos` flag is used say that we are accepting the terms. `--config` flag is used to point to the configuration file, which is found in `/opt/letsencrypt/cli.ini`.

This creates the SSL certificates in `/etc/letsencrypt/live/<domain-name>/` folder. Whenever we renew the certificates, the latest will be found in this folder.

Nginx HTTPS configuration
-------------------------
Now that we have the certificates, we can change the configuration in nginx to serve via HTTPS. The HTTPS connection is done via the port `443`. The first server block in nginx configuration at `/etc/nginx/sites-available/default` is to redirect the HTTP traffic to HTTPS. We are also returning a `301 Moved Permanently` header back. Replace the `domain-name` here to your domain.

{% highlight nginx %}
server {
  listen 80;
  server_name <domain-name>;
  return 301 https://$host$request_uri;
}
{% endhighlight %}

The second server block is for HTTPS running at port 443. It uses the certificates found at `/etc/letsencrypt/live/<domain-name>`

{% highlight nginx %}
server {
  listen 443 ssl;
  server_name <domain-name>;

  ssl_certificate /etc/letsencrypt/live/<domain-name>/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/<domain-name>/privkey.pem;

  root /usr/share/nginx/html;
  index index.html index.htm index.nginx-debian.html;

  location / {
    try_files $uri $uri/ =404;
  }

  location ^~ /.well-known/ {
    allow all;
  }
}
{% endhighlight %}

You can reload the nginx with,
{% highlight bash %}
service nginx reload
{% endhighlight %}

If your are using reverse-proxy to host in some other port, the configuration will look like this.

{% highlight nginx %}
server {
  listen 4125;
  server_name <domain-name>;

  error_page 497 https://$host:4125$request_uri;

  ssl on;
  ssl_certificate /etc/letsencrypt/live/<domain-name>/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/<domain-name>/privkey.pem;

  location / {
    proxy_pass          http://127.0.0.1:4125/;
    proxy_set_header    X-Real-IP         $remote_addr;
    proxy_set_header    X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header    X_FORWARDED_PROTO https;
    proxy_set_header    Host              $http_host;
    proxy_buffering     off;
    proxy_redirect      off;
  }
}
{% endhighlight %}

Here, the `error_page 497` is used to redirect the HTTP traffic to port `4125` to HTTPS.

Automated Renewal
-----------------
Let's Encrypt certificates are only valid for 90 days, so you would have to renew them. To renew, you just have to run the client with `--renew-by-default` flag also. The command would look like this.

{% highlight bash %}
/opt/letsencrypt/letsencrypt-auto certonly --renew-by-default --agree-tos --config /opt/letsencrypt/cli.ini
{% endhighlight %}

This command will renew the certificate. We can automate renewal by running this command as a `cron` job. Cron is a time-based job scheduler. We can make this command run once a month to renew certificates at a monthly basis to prevent it from being expired. We also need to reload the nginx configurations.

To add a new cron job, type the following command.

{% highlight bash %}
sudo crontab -e
{% endhighlight %}

Add the following lines to the end of the cron file.

{% highlight bash %}
SHELL=/bin/bash
HOME=/
MAILTO=”example@mail.com”
30 4 1 * * /opt/letsencrypt/letsencrypt-auto certonly --renew-by-default --agree-tos --config /opt/letsencrypt/cli.ini && service nginx reload >> /var/log/letsencrypt.log
{% endhighlight %}

This causes the command to run every month on the 1st at 4:30AM. The output of this command is stored in `/var/log/letsencrypt.log`.

As a side note, there are some limits on the number of certificates we can make a week for a single domain. So to try these command with no limits, you can add the flag `--server https://acme-staging.api.letsencrypt.org/directory` to Let's Encrypt commands. This creates dummy certificates, which are NOT valid but you can use it to test the working of the cron job.