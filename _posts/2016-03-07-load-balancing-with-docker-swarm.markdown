---
summary: Docker Swarm lets us group a number of hosts into a cluster and distribute the docker images among these hosts. We will deploy a load balancer that will distribute the traffic to different instances of the docker images in the swarm.
title: Load Balancing with Docker Swarm
layout: post
categories: devops
gh: https://github.com/botleg/load-balancing-swarm
bg: "background:rgb(11, 121, 194);background-image:linear-gradient(90deg, rgb(11, 121, 194) 25%, rgb(39, 174, 96) 100%);background-image:-moz-linear-gradient(left, rgb(11, 121, 194) 25%, rgb(39, 174, 96) 100%);background-image:-webkit-linear-gradient(left, rgb(11, 121, 194) 25%, rgb(39, 174, 96) 100%);background-image:-o-linear-gradient(left, rgb(11, 121, 194) 25%, rgb(39, 174, 96) 100%);background-image:-ms-linear-gradient(left, rgb(11, 121, 194) 25%, rgb(39, 174, 96) 100%);"
date:   2016-03-08 02:00:00
tags: docker swarm cluster nodejs redis nginx consul consul-template multi-host networking overlay digitalocean compose machine
---
> Docker Swarm is native clustering for Docker. It turns a pool of Docker hosts into a single, virtual Docker host.

Docker Swarm lets us group a number of hosts into a cluster and distribute the docker images among these hosts. So, the workload in divided by the nodes in the swarm. In this article, we are going to deploy and scale an application. We will also deploy a load balancer that will distribute the traffic to different instances of the docker images in the swarm. You can follow along this article with only your terminal.

In my [previous article](/stories/orchestrate-docker-containers-with-tutum/), we discussed load balancing with a docker orchestration tool, [Docker Cloud](https://cloud.docker.com/) (previously known as [Tutum](https://www.tutum.co/)). Now, we do the same thing with Docker Swarm. The docker image for load balancer is [hanzel/load-balancing-swarm](https://hub.docker.com/r/hanzel/load-balancing-swarm/) and its code can be found [here](https://github.com/botleg/load-balancing-swarm). We are load balancing a Node.js application with Redis as the database. Also, the docker image for the Node.js application is [hanzel/tutum-nodejs-redis](https://hub.docker.com/r/hanzel/tutum-nodejs-redis/) and its code can be found [here](https://github.com/botleg/tutum-nodejs-redis). For Redis, we use its official docker image - [redis](https://hub.docker.com/_/redis/).

Prerequisites
-------------

We will be using [Docker Machine](https://docs.docker.com/machine/) to create and manage remote hosts as a swarm. With Docker Machine, you can create hosts on your local machine or your cloud provider. Check [this link](https://docs.docker.com/machine/drivers/) to see the drivers supported by Docker Machine. 

You need to have the following installed in you local computer:

* `Docker`: version >= 1.10, to support Docker Compose File version 2 and Multi-Host networking.
* `Docker Machine`: version >= 0.6
* `Docker Compose`: version >= 1.6, to support Docker Compose file version 2

You can create the virtual hosts in you local system if you have [VirtualBox](https://www.virtualbox.org/wiki/Downloads) installed. For this demonstration, I will be using [DigitalOcean](https://docs.docker.com/machine/).

Initial Setup
-------------

Before we start using Docker Machine, we need to setup some environment variables. You can see more about these environment variables from [here](https://docs.docker.com/machine/drivers/). Create a Personal Access Token from DigitalOcean. If you need help for that, check [this](https://www.digitalocean.com/community/tutorials/how-to-use-the-digitalocean-api-v2#how-to-generate-a-personal-access-token) out. Your token will look something like `ed1d3d280778fe0e86b7a3e0fea065cf799fce3e575c722458897354e59de0b0`.

We will use `Debian 8` as ths OS of the nodes and enable private networking, so that the hosts in the swarm can communicate with each other. Set these environment variables with the following bash commands.

{% highlight bash %}
export DIGITALOCEAN_ACCESS_TOKEN=YOUR_DIGITALOCEAN_TOKEN
export DIGITALOCEAN_PRIVATE_NETWORKING=true
export DIGITALOCEAN_IMAGE=debian-8-x64
{% endhighlight %}

Consul
------

To create a Swarm, we need access to a Key-Value store for service discovery and to store configuration. Swarm supports Consul, Etcd, and ZooKeeper. We will be using [Consul](https://www.consul.io/).

We will be creating a host for running Consul alone. It will not be a part of the swarm. So we can create a host named `consul` first.

{% highlight bash %}
docker-machine create \
  -d digitalocean \
  consul
{% endhighlight %}

This command will create a host in DigitalOcean and provision it. You can use the command `docker-machine ssh consul`, to ssh into this host. We will store the private IP of this host as `KV_IP` environment variable with the following command.

{% highlight bash %}
export KV_IP=$(docker-machine ssh consul 'ifconfig eth1 | grep "inet addr:" | cut -d: -f2 | cut -d" " -f1')
{% endhighlight %}

We need to connect out docker client to this host and then run [progrium/consul](https://hub.docker.com/r/progrium/consul/) image there.

{% highlight bash %}
eval $(docker-machine env consul)

docker run -d \
  -p ${KV_IP}:8500:8500 \
  -h consul \
  --restart always \
  progrium/consul -server -bootstrap
{% endhighlight %}

This command will pull and deploy the image in `consul` host.

The Swarm
---------

Now, we will create the swarm. A Docker swarm need a master node and an arbitrary number of ordinary nodes. The swarm master is named `master` and we will create this now.

{% highlight bash %}
docker-machine create \
  -d digitalocean \
  --swarm \
  --swarm-master \
  --swarm-discovery="consul://${KV_IP}:8500" \
  --engine-opt="cluster-store=consul://${KV_IP}:8500" \
  --engine-opt="cluster-advertise=eth1:2376" \
  master
{% endhighlight %}

The `swarm-master` flag idetifies this node as the swarm master. We also need to provide the consul endpoint as the `swarm-discovery` flag. For us, this is `consul://${KV_IP}:8500`. We will set the private IP for this host as `MASTER_IP`.

{% highlight bash %}
export MASTER_IP=$(docker-machine ssh master 'ifconfig eth1 | grep "inet addr:" | cut -d: -f2 | cut -d" " -f1')
{% endhighlight %}

We can now create any number of nodes in this swarm. For this example, we will have only one other node in the swarm and it is named `slave`. We will create this host and set its private IP as `SLAVE_IP` with the following commands.

{% highlight bash %}
docker-machine create \
  -d digitalocean \
  --swarm \
  --swarm-discovery="consul://${KV_IP}:8500" \
  --engine-opt="cluster-store=consul://${KV_IP}:8500" \
  --engine-opt="cluster-advertise=eth1:2376" \
  slave

export SLAVE_IP=$(docker-machine ssh slave 'ifconfig eth1 | grep "inet addr:" | cut -d: -f2 | cut -d" " -f1')
{% endhighlight %}

You can create more nodes in the swarm by repeating these commands by just changing the hostname. We also need to have a registrator service running in each of these hosts to keep track of all services running in each host. The `gliderlabs/registrator` image is used for this.

We need to connect our client to each of these hosts and run the registrator image.

{% highlight bash %}
eval $(docker-machine env master)

docker run -d \
  --name=registrator \
  -h ${MASTER_IP} \
  --volume=/var/run/docker.sock:/tmp/docker.sock \
  gliderlabs/registrator:latest \
  consul://${KV_IP}:8500

eval $(docker-machine env slave)

docker run -d \
  --name=registrator \
  -h ${SLAVE_IP} \
  --volume=/var/run/docker.sock:/tmp/docker.sock \
  gliderlabs/registrator:latest \
  consul://${KV_IP}:8500
{% endhighlight %}

This service will keep track of the information like IP and PORT of each service running in the host and saves it to consul. We can now connect the docker client to the swarm. For this, we use `-swarm` parameter with the swarm master.

{% highlight bash %}
eval $(docker-machine env -swarm master)
{% endhighlight %}

We can see all the hosts created with `docker-machine` with the command `docker-machine ls`. The output of this command must look something like this.

{% highlight bash %}
NAME     ACTIVE      DRIVER         STATE     URL                          SWARM             DOCKER
consul   -           digitalocean   Running   tcp://104.131.126.139:2376                     v1.10.1
master   * (swarm)   digitalocean   Running   tcp://45.55.48.84:2376       master (master)   v1.10.1
slave    -           digitalocean   Running   tcp://104.131.177.65:2376    master            v1.10.1 
{% endhighlight %}

Docker Compose
--------------

We have set up the swarm, it is ready for deployment. For this demonstration, we will be deploying multiple instances of Node.js application with a single instance of Redis as the database. The code for this Node.js application can be found [here](https://github.com/botleg/tutum-nodejs-redis). It just lets us set the read values from redis. The docker images used for this is [hanzel/tutum-nodejs-redis](https://hub.docker.com/r/hanzel/tutum-nodejs-redis/).

Docker Compose allows us to write the configuration file for this deployment. We are going to use the Docker Compose File version 2, which allows us to define configuration about the network and volumes used for the deployment in `docker-compose.yml` file. You can know more about Version 2 of compose file [here](https://docs.docker.com/compose/compose-file/#version-2).

The `docker-compose.yml` file looks like this.

{% highlight conf %}
version: '2'

services:
  web:
    image: hanzel/tutum-nodejs-redis
    ports:
      - "4000"
    environment:
      - APP_PORT=4000
      - REDIS_IP=redis
      - REDIS_PORT=6379
    depends_on:
      - redis
    networks:
      - back-tier

  redis:
    image: redis
    container_name: redis
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - back-tier

volumes:
  redis-data:
    driver: local

networks:
  back-tier:
    driver: overlay
{% endhighlight %}

The first service is `web` and it contains the image `hanzel/tutum-nodejs-redis`, which is the node.js application. We are pulishing the port 4000 inside the container. It will be mapped to some port of the host. We need to setup some environment variables:

* `APP_PORT`: Port to run the Node.js application.
* `REDIS_IP`: The IP of the redis instance.
* `REDIS_PORT`: The PORT of the redis instance.

The second service is the official `redis` image. For persistant data storage, we are creating a data volumes named `redis-data`. This volume is of the type `local`, so the data is stored in the local host system.

The services in the same network are linked. Here, both these services are in the `back-tier` network which is of the type `overlay`. The overlay network allow `multi-host networking`, this allows the service to be linked even if the these are in different hosts.

Save this code as `docker-compose.yml` and save it in a folder. Make sure that your docker client is connected to the swarm with `eval $(docker-machine env -swarm master)` command. Now open up the terminal in this folder and start the services using the following command.

{% highlight bash %}
docker-compose up -d
{% endhighlight %}

This will start up the services, which are distributed across the different hosts in the swarm. You can see details about the running services with the command `docker-compose ps`. The output must look something like this.

{% highlight bash %}
Name                       Command                          State     Ports           
-------------------------------------------------------------------------------------------------
loadbalancingswarm_web_1   npm start                        Up        45.55.48.84:32768->4000/tcp
redis                      /entrypoint.sh redis-serve ...   Up        6379/tcp                   
{% endhighlight %}

In this case, you can see the app running at `45.55.48.84:32768`.

Load Balancer
-------------

We have a single instance of the app running. We need to now implement a load balancer that can distribute the traffic across all the instances of this service. As we increase and decrease the instances of the service, we need to automatically update the load balancer. The code for the load balancer can be found [here](https://github.com/botleg/load-balancing-swarm) and the docker image for this is [hanzel/load-balancing-swarm](https://hub.docker.com/r/hanzel/load-balancing-swarm/).

We will use [nginx](https://www.nginx.com/) for load balancing and [consul-template](https://github.com/hashicorp/consul-template) to manage nginx configuration. You can also use HAproxy as the load balancer, the process is similar.

First, we need to create a template file for nginx configuration. This file is filled with the service information by consul-template and forms the configuration for nginx. The file `default.ctmpl` looks like this.

{% highlight conf %}
{{"{{"}}$app := env "APP_NAME"}}

upstream {{"{{"}}printf $app}} {
    least_conn;
    {{"{{"}}range service $app}}
    server {{"{{"}}.Address}}:{{"{{"}}.Port}} max_fails=3 fail_timeout=60 weight=1;{{"{{"}}end}}
}

server {
    listen 80 default;

    location / {
        proxy_pass http://{{"{{"}}printf $app}};
    }
}
{% endhighlight %}

We will set variable `app` with the value of environment variable `APP_NAME`. We create a upstream named with the variable `app`. The `least_conn` line causes nginx is to route traffic to the least connected instance. We need to generate `server` configuration lines for each instance of the service currently running. This is done by the code block, `{{"{{"}}range service $app}}...{{"{{"}}end}}`. The code between these directives are repeated for each instance of the service running with `{{"{{"}}.Address}}` replaced by the address and `{{"{{"}}.Port}}` replaced by its port of that instance. Next we have the server block that is listening to the port 80. This will create a reverse proxy to the upstream we just created.

We need a bash script, that acts as the entry point to this docker image. The file `start.sh` looks like this.

{% highlight bash %}
#!/bin/bash
service nginx start
consul-template -consul=$CONSUL_URL -template="/templates/default.ctmpl:/etc/nginx/conf.d/default.conf:service nginx reload"
{% endhighlight %}

This script starts up nginx service. We then start up `consul-template`. This command need two parameter. The first one is `-consul` and it requires the url for consul. We pass an environment variable for this. The next one is called `-template` and it consists of three parts seperated by a colon. The first one is the path of the template file. The second is the path where the generated configuration file must be placed. The third is the command that must by run when new configuration is generated. Here, we need to reload nginx.

The consul-template will create new configuration file whenever a service starts or stops. The information about this is collected by the registrator services running in each node is our swarm and is stored in consul.

Save these two files in folder named `files` and in its parent, we can have the `Dockerfile` and `docker-compose.yml`. The `Dockerfile` contains information on how to build this docker image.

{% highlight bash %}
FROM nginx:latest

RUN apt-get update \
  && apt-get install -y unzip

ADD files/start.sh /bin/start.sh
RUN chmod +x /bin/start.sh
ADD files/default.ctmpl /templates/default.ctmpl

ADD https://releases.hashicorp.com/consul-template/0.12.2/consul-template_0.12.2_linux_amd64.zip /usr/bin/
RUN unzip /usr/bin/consul-template_0.12.2_linux_amd64.zip -d /usr/local/bin

EXPOSE 80
ENTRYPOINT ["/bin/start.sh"]
{% endhighlight %}

This dockerfile uses `nginx` as the base and installs consul-template into it. It then copies the `start.sh` and `default.ctmpl` to required location. Finally, it exposes the port 80 and sets `start.sh` as the entry point of the image.

New Compose file
----------------

Create the file `docker-compose.yml` in the folder containing Dockerfile. We can now add this service to this file. So, the new compose file will look like this.

{% highlight conf %}
version: '2'

services:
  lb:
    build: .
    container_name: lb
    ports:
      - "80:80"
    environment:
      - APP_NAME=tutum-nodejs-redis
      - CONSUL_URL=${KV_IP}:8500
    depends_on:
      - web
    networks:
      - front-tier

  web:
    image: hanzel/tutum-nodejs-redis
    ports:
      - "4000"
    environment:
      - APP_PORT=4000
      - REDIS_IP=redis
      - REDIS_PORT=6379
    depends_on:
      - redis
    networks:
      - front-tier
      - back-tier

  redis:
    image: redis
    container_name: redis
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - back-tier

volumes:
  redis-data:
    driver: local

networks:
  front-tier:
    driver: overlay
  back-tier:
    driver: overlay
{% endhighlight %}

We have new service name `lb`. It is build using Dockerfile in the current directory. The port 80 of the container is mapped to port 80 of the host. We need to set up two environment variables:

* `APP_NAME`: The image name of the service you need to load balance. Here, it is `tutum-nodejs-redis`. You can load balance any service by providing its name here.
* `CONSUL_URL`: The url of consul. We are using the `KV_IP` environment variable for this.

We have a new overlay network named `front-tier`. This connects `lb` and `web` services. Note that, the load balancer doesn't need to connect to redis, so these are put in two different networks. The `web` services is connected to both these networks.

Instead of building a new image, you may use the image [hanzel/load-balancing-swarm](https://hub.docker.com/r/hanzel/load-balancing-swarm/). Just replace the line `build: .` with `image: hanzel/load-balancing-swarm`.

Now we need to stop and remove the running services and start the new services.

{% highlight bash %}
docker-compose stop; docker-compose rm -f
docker-compose up -d
{% endhighlight %}

We have only one instance of `web` running now. We will scale this to three with the following command.

{% highlight bash %}
docker-compose scale web=3
{% endhighlight %}

We can see that three instances of the `web` service is running when we do `docker-compose ps`. The output will look like this.

{% highlight bash %}
Name                       Command                          State   Ports               
------------------------------------------------------------------------------------------------------
lb                         /bin/start.sh                    Up      443/tcp, 104.131.177.65:80->80/tcp
loadbalancingswarm_web_1   npm start                        Up      45.55.48.84:32777->4000/tcp
loadbalancingswarm_web_2   npm start                        Up      104.131.177.65:32772->4000/tcp
loadbalancingswarm_web_3   npm start                        Up      45.55.48.84:32778->4000/tcp
redis                      /entrypoint.sh redis-serve ...   Up      6379/tcp
{% endhighlight %}

In this case, you can go to `104.131.177.65`, the IP of your `lb` service to see the application running. Refresh the page and see the `host` value changing. This shows that the load balancer is working.

You can see the nginx configuration generated by consul-template by using the command `docker exec -t lb cat /etc/nginx/conf.d/default.conf`. This should produce an output that looks like this.

{% highlight nginx %}
upstream tutum-nodejs-redis {
  least_conn;

  server 10.132.1.191:32777 max_fails=3 fail_timeout=60 weight=1;
  server 10.132.1.191:32778 max_fails=3 fail_timeout=60 weight=1;
  server 10.132.14.17:32772 max_fails=3 fail_timeout=60 weight=1;
}

server {
  listen 80 default;

  location / {
    proxy_pass http://tutum-nodejs-redis;
  }
}
{% endhighlight %}

Conclusion
----------

Docker Swarm allows us to seamlessly scale and distribute docker work load to a cluster of hosts. We have now implemented load balancing of docker images using Docker Swarm. This is just a basic application of docker swarm. You can create more sophisticated setups with docker swarm like auto-scaling, database cluster, etc. I will try talking more about that in the coming articles.

You can stop the services and remove the hosts using the following commands.

{% highlight bash %}
docker-compose stop; docker-compose rm -f
docker-machine stop consul master slave
docker-compose rm consul master slave
{% endhighlight %}