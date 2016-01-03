---
summary: Sloppy.io is a new Container as a Service platform that you can use to host and scale Docker images.
title: Docker Hosting with sloppy.io
layout: post
categories: cloud
gh: https://github.com/botleg/docker-sloppy
demo: http://botleg.sloppy.zone
bg: "background:rgb(155, 89, 182) 25%;background-image:linear-gradient(90deg, rgb(155, 89, 182) 25%, rgb(41, 128, 185) 100%);background-image:-moz-linear-gradient(left, rgb(155, 89, 182) 25%, rgb(41, 128, 185) 100%);background-image:webkit-linear-gradient(left, rgb(155, 89, 182) 25%, rgb(41, 128, 185) 100%);background-image:-o-linear-gradient(left, rgb(155, 89, 182) 25%, rgb(41, 128, 185) 100%);background-image:-ms-linear-gradient(left, rgb(155, 89, 182) 25%, rgb(41, 128, 185) 100%);"
date:   2016-01-03 16:00:00
tags: docker hub sloppy.io container node.js redis docker-compose dockerfile sloppy.json
---
[Sloppy.io](http://sloppy.io/) is a new Container as a Service (CaaS) platform that you can use to host Docker images. It is currently in a generous private beta, which provides you with 4GB RAM, 10 containers and 10GB storage for free. You can sign up for this [here](http://sloppy.io/#signup). I received the reply from them within the hour. sloppy.io makes it really easy to host and especially scale docker images.

In this article, we are going to host a Docker project in sloppy.io which has a Node.js server and Redis database. The code for this project can be found [here](https://github.com/botleg/docker-sloppy) and the demo of the site can be found [here](http://botleg.sloppy.zone). Also, the docker image we have created with Node.js server is hosted in [Docker Hub](https://hub.docker.com/r/hanzel/docker-sloppy).

The App
-------
The app has a [Redis](http://redis.io/) database and we have used the [official redis image]() for it. The Node.js application is also really basic. It connects to this redis database and lets you to set and see the value of a key. It has two routes:

* `/key`: Returns the value of the `key`.
* `/key/value`: Sets the value of the `key` to `value`.

For example, if your site is hosted at `localhost:8000`, you can go to `localhost:8000/foo/bar` to set the value of the key `foo` to `bar` and then you can go to `localhost:8000/foo` to get the value of `foo`(in this case, `bar`). You can check out the code for this in the GitHub [repo](https://github.com/botleg/docker-sloppy).

The only thing that change for Docker is that, you need to get the `host` and `port` for redis connect from environment variables. So the code to connect to the redis instance becomes,

{% highlight java %}
redis.createClient(process.env.REDIS_PORT_6379_TCP_PORT, process.env.REDIS_PORT_6379_TCP_ADDR);
{% endhighlight %}

The port exists in `REDIS_PORT_6379_TCP_PORT` and the host IP is in `REDIS_PORT_6379_TCP_ADDR`. We will talk about setting these environment varibles later.

Dockerfile
----------
To make this project a Docker image, we need a `Dockerfile` for the instructions. The Dockerfile for this project looks like this.

{% highlight ruby %}
FROM node:argon

RUN node -v

RUN mkdir -p /app
WORKDIR /app

COPY package.json /app/
RUN npm install

COPY . /app
EXPOSE 8000

CMD [ "npm", "start" ]
{% endhighlight %}

This is pretty basic stuff. We use the `node:argon` as the base image, which has version 4 of Node.js. Then we set `/app` as the working directory in the image and we copy the `package.json` file there. We run `npm install` to install all the dependencies and then copy the rest of the repo to `/app` folder. Next, we start the application with `npm start` command. This Docker image in hosted in Docker Hub named [hanzel/docker-sloppy](https://hub.docker.com/r/hanzel/docker-sloppy/). You can read more about writing Dockerfile [here](https://docs.docker.com/engine/reference/builder/).

Docker Compose
--------------
Before we actually do the hosting in sloppy.io, let's see how to do it in a PaaS tool like [Digital Ocean](https://www.digitalocean.com/) or [AWS EC2](https://aws.amazon.com/ec2/) using the `Docker Compose`. It is used to run multi-container applications and the configurations for this are given in the file `docker-compose.yml`. You can read more about it [here](https://docs.docker.com/compose/compose-file/). We have two servies, one for Node.js server and one for Redis database.

We will start with the `redis` service. 
{% highlight yaml %}
redis:
  image: redis
  command: redis-server --appendonly yes
  expose:
    - "6379"
  volumes:
    - .:/data
{% endhighlight %}
The image for this is the official `redis` image. We need to expose the port `6379` for the server to connect to it. By exposing the port, only the other linked services can access it and it is not published to the host machine. So, we have prevented external access to this redis instance. Now, for persistance storage in redis, we need to use a docker volume and map the current folder in host machine to `/data` in the docker image. We do this with the `volume` configuration. We also need to start redis with `appendonly` flag.

`docker-compose.yml` for `node` servie looks like this.
{% highlight yaml %}
node:
  image: hanzel/docker-sloppy
  ports:
    - "8000:8000"
  links:
    - redis
{% endhighlight %}
The image for this is the one we have made, `hanzel/docker-sloppy`. The Node.js server is listening to port `8000`. We then map the port `8000` in the image to port `8000` in the host machine. So the application can be accessed in `localhost:8000`. 

We link this service to the `redis` service that we had defined earlier. Because of this linking, we can access the redis instance from `node` service. This creates the environment variables `REDIS_PORT_6379_TCP_ADDR` (for host address of redis instance) and `REDIS_PORT_6379_TCP_PORT` (for port of the redis instance), which can be accessed from within the  Node.js application.

The entire `docker-compose.yml` looks like this,
{% highlight yml %}
node:
  image: hanzel/docker-sloppy
  ports:
    - "8000:8000"
  links:
    - redis

redis:
  image: redis
  command: redis-server --appendonly yes
  expose:
    - "6379"
  volumes:
    - .:/data
{% endhighlight %}

Now, you can start this application with `docker-compose up -d` command.

Hosting with sloppy.io
----------------------
Hosting in sloppy.io is similar to using `Docker Compose`, but you need to write `sloppy.json` for configurations here. Most of the parameters here are the same, but there are a few additional parameters here, which is for the hosting purpose. Documentation about `sloppy.json` can be found [here](http://sloppy.io/home/documentation/reference/the-sloppy-json/).

In the json file, each project can have multiple services and each service can have multiple apps. That seems a bit overwhelming. In most cases, we would need only one application in each service. For this application, we have two services:

* `frontend`, containing the `node` application.
* `backend`, containing the `redis` application.

The json for `frontend` service is given below.
{% highlight json %}
{
  "id": "frontend",
  "apps": [{
    "id": "node",
    "domain": {
      "uri": "{subdomain-name}.sloppy.zone",
      "type": "HTTP"
    },
    "instances": 2,
    "mem": 512,
    "image": "hanzel/docker-sloppy",
    "port_mappings": [{
      "container_port": 8000
    }],
    "env": {
      "REDIS_PORT_6379_TCP_ADDR": "redis.backend.botleg.{user-name}"
    },
    "dependencies": [
      "../../backend/redis"
    ]
  }]
}
{% endhighlight %}

Here, we have one app named `node`. The default url provied by sloppy.io is a `sloppy.zone` subdomain. You can also use a custom domain with CNAME records. We use the domain property object to choose the service URL, change `{subdomain-name}` as you require. Next, we have asked sloppy to create 2 instances of this application, with each instance having 512MB RAM. Then we have the docker image name, which is `hanzel/docker-sloppy`. We use the `port_mappings` property to tell which port of the container to be used when the URL is accessed.

Instead of `links` property in `docker-compose.yml`, we have `dependencies`. We will write the `backend` service soon and it will have the `redis` app. Now, this dependency doesn't create the environment variable as we had seen in `Docker Compose`. Rather, the host of the redis instance can be accessed with `redis.backend.botleg.{user-name}`. Here change `{user-name}` to your sloppy.io username. This gives the IP for redis app in backend service of botleg project by `{user-name}`. To make our application work, we need to set this as the environment variable `REDIS_PORT_6379_TCP_ADDR`.

The json configuration for `backend` service is given below.
{% highlight json %}
{
  "id": "backend",
  "apps": [{
    "id": "redis",
    "instances": 1,
    "mem": 512,
    "image": "redis",
    "cmd": "redis-server --appendonly yes",
    "volumes": [{
      "container_path": "/data/",
      "mode": "RW",
      "size": "40MB"
    }]

  }]
}
{% endhighlight %}

We have an app name `redis` and we have one 512MB RAM instance of it. The image used in the official `redis` image. We start `redis-server` with `--appendonly` flag with the `command` property. We then set a 40MB docker volume pointing to `/data` in the docker image.

The entire sloppy.json will look like this.
{% highlight json %}
{
  "project": "botleg",
  "services": [{
    "id": "frontend",
    "apps": [{
      "id": "node",
      "domain": {
        "uri": "{subdomain-name}.sloppy.zone",
        "type": "HTTP"
      },
      "instances": 2,
      "mem": 512,
      "image": "hanzel/docker-sloppy",
      "port_mappings": [{
        "container_port": 8000
      }],
      "env": {
        "REDIS_PORT_6379_TCP_ADDR": "redis.backend.botleg.{user-name}"
      },
      "dependencies": [
        "../../backend/redis"
      ]
    }]
  }, {
    "id": "backend",
    "apps": [{
      "id": "redis",
      "instances": 1,
      "mem": 512,
      "image": "redis",
      "cmd": "redis-server --appendonly yes",
      "volumes": [{
        "container_path": "/data/",
        "mode": "RW",
        "size": "40MB"
      }]

    }]
  }]
}
{% endhighlight %}

To host this project, install sloppy CLI from [here](http://sloppy.io/home/documentation/). Login in with sloppy CLI with `sloppy login` command. Type in your sloppy.io username and password. Then come to folder where you have this `sloppy.json` and type the command `sloppy start sloppy.json`. This will start up the application in a few minutes.

Conclusion
----------
Now, you have seen how easy it is to host Docker images with [sloppy.io](http://sloppy.io/). If you have experience with `Docker Compose`, you will feel right at home. Even otherwise, it is pretty simple. If you are working with Dockers, a CaaS like sloppy.io will provide you with easy hosting and scaling of the Docker images.