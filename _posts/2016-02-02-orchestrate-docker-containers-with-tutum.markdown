---
summary: Tutum provides us with easy access to features like deploying, linking, load balancing and scaling when using Docker hosting.
title: Orchestrate Docker containers with Tutum
layout: post
categories: devops
gh: https://github.com/botleg/tutum-nodejs-redis
bg: "background:rgb(52, 73, 94) 25%;background-image: linear-gradient(90deg, rgb(52, 73, 94) 25%, rgb(41, 128, 185) 100%);background-image: -moz-linear-gradient(left, rgb(52, 73, 94) 25%, rgb(41, 128, 185) 100%);background-image: -webkit-linear-gradient(left, rgb(52, 73, 94) 25%, rgb(41, 128, 185) 100%);background-image: -o-linear-gradient(left, rgb(52, 73, 94) 25%, rgb(41, 128, 185) 100%);background-image: -ms-linear-gradient(left, rgb(52, 73, 94) 25%, rgb(41, 128, 185) 100%);"
date:   2016-02-03 01:00:00
tags: tutum docker container haproxy node.js redis scale load balance deploy popular
---
[Tutum](https://www.tutum.co/) simplifies the process of hosting Docker containers. We can connect Tutum to our cloud provider and create node clusters. We can then deploy, scale and link Docker containers from the Tutum interface. In this article, we will see how to deploy a Node.js application with Redis as the data store. We will also scale this application and use load balacing. The entire code for this application can be found [here](https://github.com/botleg/tutum-nodejs-redis).

The Containers
--------------

I have made a simple Node.js application that connects to Redis database and lets you to set and see the value of a key. We use the [official image](https://hub.docker.com/_/redis/) for Redis. The app has three endpoints:

* `/key`: Returns the value of the `key`.
* `/key/value`: Sets the value of the `key` to `value`.
* `/`: Return the host name.

For example, if your site is hosted at `localhost:8000`, you can go to `localhost:8000/foo/bar` to set the value of the key `foo` to `bar` and then you can go to `localhost:8000/foo` to get the value of `foo`(in this case, `bar`). To check load balacing, all the endpoints returns the current host name.

You can check out the code for this in the GitHub [repo](https://github.com/botleg/tutum-nodejs-redis). It is also built into a Docker image under [hanzel/tutum-nodejs-redis](https://hub.docker.com/r/hanzel/tutum-nodejs-redis/).

To run this application, you need to set the following environment variables:

* `APP_PORT`: Port to run the Node.js application.
* `REDIS_IP`: The IP of the redis instance.
* `REDIS_PORT`: The PORT of the redis instance.

We are going to use HAProxy to do the load balancing. Tutum provides it's own docker [image](https://github.com/tutumcloud/haproxy) for HAProxy. If we deploy this image in Tutum and the link a service, it will configure itself based on the target number of containers of that linked service.

Creating a Node clusters
------------------------

Create an account with [Tutum](https://www.tutum.co/). Then connect it to your favourite cloud provider. Nodes are server instances or hosts, where we will be hosting the containers.

Goto Nodes tab and click on the `Launch your first node` button. Give a name for the cluster. You can use `Deploy tags` to specify where you want the services to be hosted. For this article, it's not needed. Now select your provider, region and instance type, as needed. I am selecting 1GB instance from Digital Ocean.

{% include image.html img="tutum-nodes" title="New node cluster settings" %}
*New node cluster settings*{: .image-caption }

Now select the number of nodes you want in your cluster. I want two nodes in the cluster. You can change any time as needed. Now click the button `Launch node cluster` button to deploy the cluster. This could take a few minutes. Once it's ready, we can see the status `Deployed` for each node.

Stackfiles
----------

Each docker image running are called services here. We can add each services and configure it from the Tutum web UI with the `Services` tab. However, this is not the best way to do this.

Tutum supports configuration files called `Stackfiles` and those files are named `tutum.yml`. This is very similar to `docker-compose.yml` with additional parameters for the deployment configuration. We can specify, configure and link services with this file.

We will start with the redis service. The configuration required for this is given below:

{% highlight conf %}
redis:
  image: 'redis'
  target_num_containers: 1
  deployment_strategy: high_availability
  command: redis-server --appendonly yes
  expose:
    - '6379'
  volumes:
    - /data
{% endhighlight %}

The image used in `redis`. The next two parameters are for deployment purpose. The `target_num_containers` parameters is for scaling and it show how many instance of this containers that we need. We need only one instance of Redis. There are many deployment strategies available. The `high_availability` value ensures that the containers are deployment in such a way that it's is always available. You can read more about these parameters in [Stackfile docs](https://support.tutum.co/support/solutions/articles/5000583471-stack-yaml-reference). We use the command `redis-server --appendonly yes` for persistance with Redis. We need to expose the port 6379 of Redis container to link it to other services. The final parameter `volumes`, save the data in `/data` folder for persistance.

The configuration for Node.js application is given below:

{% highlight conf %}
node:
  image: 'hanzel/tutum-nodejs-redis'
  target_num_containers: 4
  deployment_strategy: high_availability
  links:
    - redis
  environment:
    APP_PORT: 4000
    REDIS_IP: redis
    REDIS_PORT: 6379
  expose:
    - '4000'
{% endhighlight %}

The images used here is `hanzel/tutum-nodejs-redis`. We are using the load balancing of this service. So we will have four instances of this container. Since we have used the `high_availability` deployment strategy, each of our two nodes will have two containers of this image each. 

We are linking the redis service to this service with the `links` paramter. This allows us to access the port 6379 of redis, which is the exposed port of redis service. We can also access the IP of redis service with `redis` keyword.

Now, we need to set the environment variables. This application will run on the port defined in `APP_PORT` variable, 4000 in this case. The IP for redis instance is `redis` and the port is 6379. We now expose the port 4000 of this application.

The final service that we use is for load balancing and the configuration for this is given below:

{% highlight conf %}
lb:
  image: 'tutum/haproxy:latest'
  links:
    - node
  ports:
    - '80:80'
  restart: always
  roles:
    - global
{% endhighlight %}

The image used here is `tutum/haproxy:latest` and we are linking the `node` service. With the `ports` parameter, we can set the ports that are publicly accessible. We are mapping the port `80` of the host device with port `80` of this container. We set the `restart` parameter to `always` so that this service will restarted everytime it stops. We also need to set the `roles` parameter to `global`. This allow this service to communicate with Tutum APIs and reconfigure based on your cluster.

So the entire Stackfile will be this.

{% highlight conf %}
lb:
  image: 'tutum/haproxy:latest'
  links:
    - node
  ports:
    - '80:80'
  restart: always
  roles:
    - global

node:
  image: 'hanzel/tutum-nodejs-redis'
  target_num_containers: 4
  deployment_strategy: high_availability
  links:
    - redis
  environment:
    APP_PORT: 4000
    REDIS_IP: redis
    REDIS_PORT: 6379
  expose:
    - '4000'

redis:
  image: 'redis'
  target_num_containers: 1
  deployment_strategy: high_availability
  command: redis-server --appendonly yes
  expose:
    - '6379'
  volumes:
    - /data
{% endhighlight %}

Deploying the Stack
-------------------

To deploy this stack, goto the `Stacks` tab in Tutum and click the `Create stack` button. Now give a name for this stack and paste [the Stackfile](https://stackfiles.io/registry/56a37bc035a28a01009e57ed). Now, click `Create and deploy`. This will deploy all the services. This can also take a few minutes.

Once the stack is running, goto `Endpoints` tab in the stack. This will have all publicly accessible ports of any service. We have only one, the port 80 in load balancer service. A `tutum.io` subdomain will be created for this. Open this link to access your stack.

You can see the hostname in the page. Try reloading this page and we can see that the hostname is changing. This shows that out load balancing is working.

TL;DR
-----

In this article, we deployed a load balanced Node.js application and Redis database with Docker containers with [Tutum](https://www.tutum.co/). We have seen that, Tutum provides us with easy access to powerful features like load balancing and scaling when using Docker hosting.
