---
summary: We will set up an auto-scaling system with Docker using Docker Remote API. This can be used to scale the service as the traffic increases. We will make a docker image that replicates services and will tested it on an app deployed with Docker Swarm.
title: Auto Scaling More
layout: post
categories: devops
gh: https://github.com/botleg/replicator
bg: "background:rgb(142, 68, 173);background-image:linear-gradient(90deg, rgb(142, 68, 173) 25%, rgb(192, 57, 43) 100%);background-image:-moz-linear-gradient(left, rgb(142, 68, 173) 25%, rgb(192, 57, 43) 100%);background-image:-webkit-linear-gradient(left, rgb(142, 68, 173) 25%, rgb(192, 57, 43) 100%);background-image:-o-linear-gradient(left, rgb(142, 68, 173) 25%, rgb(192, 57, 43) 100%);background-image:-ms-linear-gradient(left, rgb(142, 68, 173) 25%, rgb(192, 57, 43) 100%);"
date: 2016-07-13 18:00:00
tags: auto-scaling replicator remote API docker machine swarm registrator nginx digitalocean compose machine bash Dockerfile Node.js nginx
---

In this article, we are going to automate the scaling procedure using [Docker Remote API](https://docs.docker.com/engine/reference/api/docker_remote_api/). We will be creating a `Replicator` docker image that listens to requests with container ID as the parameter and can create and deploy new docker images similar to the one with the given container ID.

The docker image for Replicator is [hanzel/replicator](https://hub.docker.com/r/hanzel/replicator/) and its code can be found [here](https://github.com/botleg/replicator). Also, the docker image for testing this is [hanzel/node-replicate](https://hub.docker.com/r/hanzel/node-replicate/) and its code can be found [here](https://github.com/botleg/node-replicate).

Docker Remote API
-----------------

[Docker Remote API](https://docs.docker.com/engine/reference/api/docker_remote_api/) allows us to remotely access the Docker Engine and do all the actions that we could do locally. You can see the API reference [here](https://docs.docker.com/engine/reference/api/docker_remote_api_v1.23/). For our purposes, we need the following endpoints:

* `GET /containers/<id>/json`: To inspect the container.
* `POST /containers/create`: To create a new container.
* `POST /containers/<id>/start`: To deploy the new container.

To send requests to the Docker Remote API, we need to verify the client using the certificate (cert.pem) and the private key (key.pem) files. To verify the client, we also need the certificate authority (ca.pem) file. When using Docker Machine, the environment variable `DOCKER_CERT_PATH` contains the path of the folder containing these files.

The `Replicator` docker image will listen for requests which contains a container ID. This ID is used to inspect the container and create one similar to it. Then the newly created container is deployed. Now we can scale by sending a request to this Replicator image with the container ID. This can be done in two ways:

* A running container can request the Replicator with its own container ID, if it cannot handle the traffic.
* The container can send metrics to some monitoring service along with its container ID. Then the monitoring service can send the request to the Replicator with the container ID as needed.

Replicator Image
----------------

The Replicator image will be based on the [Alpine Linux](https://www.alpinelinux.org/) and it will contain a [Node.js](https://nodejs.org/) server along with [NGINX](https://www.nginx.com/). Node.js server will be used to listen for the request and communicate with Docker Remote API. NGINX is used as a reverse proxy to the Node.js server and it also handle the client verification with the certificates. The docker image for Replicator is [hanzel/replicator](https://hub.docker.com/r/hanzel/replicator/) and its code can be found [here](https://github.com/botleg/replicator).

We need the certificate and key file to access the Remote API. So, we use these same files to authenticate the clients of our Docker Image. We need to have the file `cert.pem`, `key.pem`, `ca.pem` in the folder `/ssl` in our Docker Image. We will discuss how to get the files there later when we are testing this image. We also need to set the `DOCKER_HOST` environment variable with IP and port to access the Remote API. The Docker Machine save this in the format `tcp://<ip>:<port>` inside the environment variable `DOCKER_HOST`. We just have to pass this value to the docker image. In the next three sections, we will build the Replicator image.

Node.js Application
-------------------

The Node.js application will contain only one javascript file `server.js` and uses [koa](http://koajs.com/) as the web server and `co-request` to send requests to Docker Remote API. So the `package.json` file will look like this.

{% highlight json %}
{
  "name": "replicator",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "co-request": "1.0.0",
    "koa": "1.2.0"
  }
}
{% endhighlight %}

The `server.js` files starts with setting values to the variables.

{% highlight javascript %}
const app = require('koa')(),
  fs = require('fs'),
  request = require('co-request');

const cert = fs.readFileSync('/ssl/cert.pem'),
  key = fs.readFileSync('/ssl/key.pem'),
  ca = fs.readFileSync('/ssl/ca.pem'),
  host = process.env.DOCKER_HOST.substr(6);
{% endhighlight %}

We assiged the `koa` module to `app`, `fs` module to `fs` and `co-request` module to `request`. The file `/ssl/cert.pem` is read and saved to `cert`. Similarly, value of `key` and `ca` is set. We have the IP and port to access the Remote API in the environment variable `DOCKER_HOST` in the format `tcp://<ip>:<port>`. We strip out the `tcp://` part of it and save it to `host` variable. So, if the value of the environment variable `DOCKER_HOST` is `tcp://192.168.99.100:2376`, the value of `host` will be `192.168.99.100:2376`.

Now we have to write the function that handles all the requests. We accept GET request with container ID as the URL parameter. So the request `GET /9d65f58cca99` will be accepted and the container ID is `9d65f58cca99`. The function looks like the following.

{% highlight javascript %}
app.use(function *(){
  if (this.url !== '/') {    
    var container = this.url.slice(1);

    var options = {
      url: 'https://'+host+'/containers/'+container+'/json',
      cert: cert,
      key: key,
      ca: ca
    };

    var info = yield request(options);

    if (info.statusCode == 200) {
      options.url = 'https://'+host+'/containers/create';
      options.json = true;
      options.body = JSON.parse(info.body).Config;
      options.body.Hostname = "";
      options.body.HostConfig = JSON.parse(info.body).HostConfig;
      var init = yield request.post(options);

      options.url = 'https://'+host+'/containers/'+init.body.Id+'/start';
      options.body = null;
      var start = yield request.post(options);

      this.status = 200;
      this.body = 'done';
    } else {
        this.status = 404;
        this.body = 'invalid container id'; 
    }
  } else {
    this.status = 400;
    this.body = 'container id missing';
  }
});
{% endhighlight %}

First of all, we check if there is any URL parameter. If there is no parameter, we send a `400 BAD REQUEST` response. Or else, we take the container ID from the URL, save it in `container` variable and continue. We send a `GET /containers/<id>/json` request to the Docker Remote API to get the configuration of the given image using the `cert`, `key` and `ca` variables for authentication. The URL for this is `'https://'+host+'/containers/'+container+'/json'`.

If the response code for this request is not 200, we send a `404 NOT FOUND` response. This happens when the container ID is invalid. If the response code is 200, we continue. Now, we have to send a `POST /containers/create` request. The body of this request must contain the configuration of the Docker Image that we wish to create. As we are going to duplicate the image, whose ID was given, this can be obtained from the reponse of the previous request. The body of this request is composed of the `Config` object of the previous response.

Now we need to empty the value of `Hostname` parameter in the body. This is done so that the newly created image will have a unique hostname which is the substring of its ID. Now we have to set the `HostConfig` parameter in the request body. This is be obtained from the `HostConfig` object in the previous reponse. Now we send this `POST /containers/create` request and the new container is created. The response from this request will contain the ID of the new container in the `Id` parameter.

Now we send the `POST /containers/<id>/start` request to start this newly created container. The ID for this reqeust can be obtained from the previous response, so the URL will be `'https://'+host+'/containers/'+init.body.Id+'/start'`. This will start the new container and we can now send the `200 OK` response with `done` as the body.

Finally, we need to make this app listen to the port `3000` using the command, `app.listen(3000)`. So the entire `server.js` file looks like this.

{% highlight javascript %}
const app = require('koa')(),
  fs = require('fs'),
  request = require('co-request');

const cert = fs.readFileSync('/ssl/cert.pem'),
  key = fs.readFileSync('/ssl/key.pem'),
  ca = fs.readFileSync('/ssl/ca.pem'),
  host = process.env.DOCKER_HOST.substr(6);

app.use(function *(){
  if (this.url !== '/') {    
    var container = this.url.slice(1);

    var options = {
      url: 'https://'+host+'/containers/'+container+'/json',
      cert: cert,
      key: key,
      ca: ca
    };

    var info = yield request(options);

    if (info.statusCode == 200) {
      options.url = 'https://'+host+'/containers/create';
      options.json = true;
      options.body = JSON.parse(info.body).Config;
      options.body.Hostname = "";
      options.body.HostConfig = JSON.parse(info.body).HostConfig;
      var init = yield request.post(options);

      options.url = 'https://'+host+'/containers/'+init.body.Id+'/start';
      options.body = null;
      var start = yield request.post(options);

      this.status = 200;
      this.body = 'done';
    } else {
      this.status = 404;
      this.body = 'invalid container id'; 
    }
  } else {
    this.status = 400;
    this.body = 'container id missing';
  }
});

app.listen(3000);
{% endhighlight %}

NGINX Configuration
-------------------

We are using NGINX as the reverse proxy to our Node.js Application. NGINX is also used for SSL termination and client authentication. The encrypted requests will be received by the NGINX server, the SSL will be terminated and the plain-text requests will be forwarded to our Node.js server running at port `3000`. The configuration file `nginx.conf` look like this.

{% highlight nginx %}
worker_processes  1;
pid /var/run/nginx.pid;

events {
  worker_connections  1024;
}

http {
  server {
    listen 443 ssl;

    ssl_certificate /ssl/cert.pem;
    ssl_certificate_key /ssl/key.pem;
    ssl_client_certificate /ssl/ca.pem;
    ssl_verify_client on;

    location / {
      add_header          Access-Control-Allow-Origin *;
      add_header          Access-Control-Allow-Methods GET;
      proxy_pass          http://127.0.0.1:3000/;
      proxy_set_header    X-Real-IP         $remote_addr;
      proxy_set_header    X-Forwarded-For   $proxy_add_x_forwarded_for;
      proxy_set_header    X_FORWARDED_PROTO https;
      proxy_set_header    Host              $http_host;
      proxy_buffering     off;
      proxy_redirect      off;
    }
  }
}
{% endhighlight %}

NGINX listens to port 443 with SSL turned on. As, port 443 is the default port for SSL, we can now access this service with `https` without any ports. We authenticate the clients using the files `cert.pem`, `key.pem` and `ca.pem` in the `/ssl` folder. We use the `proxy_pass` parameter to pass these requests to the Node.js server listening at port `3000`.

Replicator Dockerfile
---------------------

We need to have both Node.js and NGINX to be running inside the docker image. So we will write a script `start.sh` which acts as our entry point.

{% highlight bash %}
#!/bin/sh

nginx -g 'daemon off;' &
npm start
{% endhighlight %}

Our Docker Image will be based on Alpine Linux with Node.js server and NGINX running in it. We need to put the four files `package.json`, `server.js`, `nginx.conf` and `start.sh` into a folder named `files`. Create the `Dockerfile` in the folder containing this `files` folder and it will contain the following.

{% highlight c %}
FROM mhart/alpine-node:6

RUN apk add --update --no-cache nginx

ADD files/package.json files/server.js /code/
WORKDIR /code
RUN npm install

ADD files/nginx.conf /etc/nginx
ADD files/start.sh /bin/start.sh
RUN chmod +x /bin/start.sh

EXPOSE 443
ENTRYPOINT ["/bin/start.sh"]
{% endhighlight %}

The base image is `mhart/alpine-node:6`, which is based on Alpine Linux and contains Node.js v6. We install nginx using Alpine Pacakge Manager, `apk`. We move the files `package.json` and `server.js` to the folder `/code` in the image and it will act as the working directory. We run `npm install` in this location to install all Node.js dependencies from `package.json`.

Next, we move the file `nginx.conf` to `/etc/nginx` folder and `start.sh` to `/bin` folder. We make the `start.sh` executable with `chmod` command. The port `443` will be exposed and accessible from outside. This port is listened by NGINX. Finally, we set the `start.sh` file as the entry point to this image. You can build this image with the command `docker build -t replicator .`.

Testing
-------

To send requests to the replicator from inside a running container, the replicator must run in the same network. If the container name of the replicator image is `replicator`, we can send request to `https://replicator`. We also need to provide the container ID as the URL parameter. This value can be accessed from the environment variable `HOSTNAME`.

For authentication of this request, we need to provide the certificate file (cert.pem) and its private key (key.pem). If `curl` is installed in the image and the authentication files are in `/ssl` folder, we can make this request using the following command.

{% highlight bash %}
curl --insecure --cert /ssl/cert.pem --key /ssl/key.pem "https://replicator/$HOSTNAME"
{% endhighlight %}

To test the working of this replicator image, I have made a docker image. This docker image contains a Node.js server that server an HTML page with a button. If the button is clicked, the above `curl` command is executed. I have built it into a docker image, [hanzel/node-replicate](https://hub.docker.com/r/hanzel/node-replicate/) and its code can be found [here](https://github.com/botleg/node-replicate). With this image, we can see that everytime we click the button a new instance of this service will be spun up. We will be deploying all this to a Docker Swarm now.

Creating the Swarm
------------------

We will be using [Docker Machine](https://docs.docker.com/machine/) to create and manage remote hosts as a swarm. With Docker Machine, you can create hosts on your local machine or your cloud provider. Check [this link](https://docs.docker.com/machine/drivers/) to see the drivers supported by Docker Machine. 

You need to have the following installed in you local computer:

* `Docker`: version >= 1.10, to support Docker Compose File version 2 and Multi-Host networking.
* `Docker Machine`: version >= 0.6
* `Docker Compose`: version >= 1.6, to support Docker Compose file version 2

You can create the virtual hosts in you local system if you have [VirtualBox](https://www.virtualbox.org/wiki/Downloads) installed. For this demonstration, I will be using [DigitalOcean](https://www.digitalocean.com/).

The first thing we need to do is to create the Docker Swarm using Docker Machine and set it up. I have explained how to do this in the article, [Load Balancing with Docker Swarm](/stories/load-balancing-with-docker-swarm/). Follow the steps from `Initial Setup` to `The Swarm` of that article to create and setup the Swarm.

Once the swarm is setup, you can see the hosts with `docker-machine ls` command. The output of this command must look something like this.

{% highlight bash %}
NAME     ACTIVE      DRIVER         STATE     URL                          SWARM             DOCKER
consul   -           digitalocean   Running   tcp://104.131.23.60:2376                       v1.11.2
master   * (swarm)   digitalocean   Running   tcp://104.131.109.181:2376   master (master)   v1.11.2
slave    -           digitalocean   Running   tcp://45.55.243.156:2376     master            v1.11.2 
{% endhighlight %}

Key Distribution
----------------

For the replicator image to access the Docker Remote API, it needs the certificate file (cert.pem), private key (key.pem) and certificate authority file (ca.pem). As we are using Docker Machine, the value in the environment variable `DOCKER_CERT_PATH` is the path of the folder containing these files. We are also going to use these same files to authenticate requests coming to the replicator. So we need to have these three files in the `replicator` and `node-replicate` image.

Before moving the files to the Docker images, we need to get the files to all the remote hosts that we create with Docker Machine. We create a new folder name `ssl` and copy the required three file to this folder.

{% highlight bash %}
mkdir ssl
cp $DOCKER_CERT_PATH/cert.pem $DOCKER_CERT_PATH/key.pem $DOCKER_CERT_PATH/ca.pem ssl/
{% endhighlight %}

We now use `docker-machine scp` command to copy the contents of `ssl` folder to `/home/ssl` folder in the remote hosts `master` and `slave`.

{% highlight bash %}
docker-machine scp -r ssl master:/home/ssl
docker-machine scp -r ssl slave:/home/ssl
{% endhighlight %}

If you have more remote hosts, just repeat these commands by changing the host name. Once these files are in the remote hosts, you can create volumes that point from `/home/ssl` in the host to `/ssl` in the container, to bring these files into the containers.

Running with Docker Compose
---------------------------

We will test the working of the replicator using Docker Compose. The configuration file `docker-compose.yml` looks like the following.

{% highlight conf %}
version: '2'

networks:
  web:
    driver: overlay

services:
  replicator:
    image: hanzel/replicator
    container_name: replicator
    ports:
      - "443:443"
    environment:
      - constraint:node==slave
      - DOCKER_HOST=${DOCKER_HOST}
    volumes:
      - /home/ssl:/ssl
    networks:
      - web

  lb:
    image: hanzel/load-balancing-swarm
    container_name: lb
    ports:
      - "80:80"
    environment:
      - constraint:node==master
      - APP_NAME=node-replicate
      - CONSUL_URL=${KV_IP}:8500
    depends_on:
      - web
    networks:
      - web

  web:
    image: hanzel/node-replicate
    ports:
      - "3000"
    volumes:
      - /home/ssl:/ssl
    networks:
      - web
{% endhighlight %}

We have an overlay network `web` that contains all the services. The first service is the `replicator` and uses `hanzel/replicator` image. We give the name `replicator` for this container and export the port `443`. This make the replicator accessible at `https://replicator`. We set the `constraint:node` environment variable to `slave` so that this container always runs in the `slave` remote host. As discussed above, we need to set the `DOCKER_HOST` environment variable to the URL to access the Remote API. This is set in the `DOCKER_HOST` environment variable set by the `docker-machine`. We also need to create a Docker Volume from `/home/ssl` in the host to `/ssl` in the container to share the certificates and keys.

The second service is a load balancer which can distibuted the traffic to different instances of the same image. To know more about this service, read my article [Load Balancing with Docker Swarm](/stories/load-balancing-with-docker-swarm/). The third service is named `web` and contains the image `hanzel/node-replicate` that was created to test the replicator. It listens to port `3000`, so it is exposed. As this service make requests to the replicator, it need the same certificates and keys for authentication. This is done by creating a docker volume similar to `replicator` service.

Make sure that your docker client is connected to the swarm with `eval $(docker-machine env -swarm master)` command. Now open up the terminal in the folder containing `docker-compose.yml` and start the services using the following command.

{% highlight bash %}
docker-compose up -d
{% endhighlight %}

This will start these services. You can see the running containers with the command `docker-compose ps`. The output of the command must look like this.

{% highlight bash %}
Name         Command         State   Ports           
------------------------------------------------------------------------
lb           /bin/start.sh   Up      443/tcp, 104.131.109.181:80->80/tcp
replicator   /bin/start.sh   Up      104.131.109.181:443->443/tcp
tmp_web_1    npm start       Up      45.55.243.156:32772->3000/tcp
{% endhighlight %}

We can see the application from the url given by the command, `docker-compose port lb 80`. You will get some IP address like `104.131.109.181:80`. Go to this url and we can see the running app. To test the `replicator`, click on the `Replicate` button. This sends a request to replicator with the current container's ID and the replicator will create a new service similar to this and deploy it. Once all that is done, the text `done` appears in the webpage.

Check again the running services with `docker-compose ps` command and we can see two instances of our `node-replicate` images running.

{% highlight bash %}
Name                Command         State   Ports           
------------------------------------------------------------------------
lb                  /bin/start.sh   Up      443/tcp, 104.131.109.181:80->80/tcp
replicator          /bin/start.sh   Up      104.131.109.181:443->443/tcp
reverent_dubinsky   npm start       Up      45.55.243.156:32773->3000/tcp
tmp_web_1           npm start       Up      45.55.243.156:32772->3000/tcp
{% endhighlight %}

Here, the container named `reverent_dubinsky` in the new one replicated. Everytime we press the button, a new instance will be deployed. You can also send the request to replicator externally. You need to have the certificate and key file in the `ssl` folder. Run the command `docker ps` to get the list of running container. Pick the required container and note its ID. Now run the following command to replicate this container.

{% highlight bash %}
curl --insecure --cert ssl/cert.pem --key ssl/key.pem "https://$(docker-machine ip slave)/<container-id>"

# Example: If the container ID is 'd44f756ca3a1'
curl --insecure --cert ssl/cert.pem --key ssl/key.pem "https://$(docker-machine ip slave)/d44f756ca3a1"
{% endhighlight %}

Run this command or press the button a few times and the output of `docker-compose ps` will look something like this.

{% highlight bash %}
Name                Command         State                  Ports
-------------------------------------------------------------------------------
drunk_borg          npm start       Up      104.131.109.181:32770->3000/tcp
hungry_banach       npm start       Up      104.131.109.181:32769->3000/tcp
kickass_hoover      npm start       Up      45.55.243.156:32775->3000/tcp
lb                  /bin/start.sh   Up      443/tcp, 104.131.109.181:80->80/tcp
replicator          /bin/start.sh   Up      104.131.109.181:443->443/tcp
reverent_dubinsky   npm start       Up      45.55.243.156:32773->3000/tcp
sleepy_williams     npm start       Up      45.55.243.156:32774->3000/tcp
tmp_web_1           npm start       Up      45.55.243.156:32772->3000/tcp 
{% endhighlight %}

You can still use the `docker-compose scale` command to manually scale the services. Also, you can see that the load balancer is also updated with the new instances. You can see the load balancer configuration with the command `docker exec -t lb cat /etc/nginx/conf.d/default.conf`. Its output looks something like this.

{% highlight nginx %}
upstream node-replicate {
  least_conn;

  server 10.132.11.48:32770 max_fails=3 fail_timeout=60 weight=1;
  server 10.132.11.48:32769 max_fails=3 fail_timeout=60 weight=1;
  server 10.132.69.218:32775 max_fails=3 fail_timeout=60 weight=1;
  server 10.132.69.218:32773 max_fails=3 fail_timeout=60 weight=1;
  server 10.132.69.218:32774 max_fails=3 fail_timeout=60 weight=1;
  server 10.132.69.218:32772 max_fails=3 fail_timeout=60 weight=1;
}

server {
  listen 80 default;

  location / {
    proxy_pass http://node-replicate;
  }
}
{% endhighlight %}

Conclusion
----------

In this article, we can set up an auto-scaling system with Docker using Docker Remote API. This can be used to scale the service as the traffic increases. We have made a docker image to that replicates services and tested it on an app deployed with Docker Swarm.

Once you are done, the services can be stopped and the hosts removed with the following commands.

{% highlight bash %}
docker-compose down
docker-machine stop consul master slave
docker-machine rm consul master slave
{% endhighlight %}