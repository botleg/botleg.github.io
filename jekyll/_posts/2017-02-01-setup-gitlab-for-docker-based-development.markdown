---
summary: Gitlab is an open-source git repository manager. We will deploy Gitlab for docker based projects. We will also configure Gitlab Continuous Integration and Container Registry and secure this setup with HTTPS.
title: Setup Gitlab for Docker based development
layout: post
categories: cloud
gh: https://github.com/botleg/gitlab-nginx
bg: "background:rgb(28, 120, 185);background-image:linear-gradient(160deg, rgb(28, 120, 185), rgb(104, 104, 176));background-image:-moz-linear-gradient(160deg, rgb(28, 120, 185), rgb(104, 104, 176));background-image:-webkit-linear-gradient(160deg, rgb(28, 120, 185), rgb(104, 104, 176));background-image:-o-linear-gradient(160deg, rgb(28, 120, 185), rgb(104, 104, 176));background-image:-ms-linear-gradient(160deg, rgb(28, 120, 185), rgb(104, 104, 176));
"
date: 2017-02-01 18:00:00
tags: gitlab docker nginx digitalocean bash Dockerfile CI letsencrypt https ssl registry runner
---
[Gitlab](https://about.gitlab.com/) is known as the open-source git repository manager. However, Gitlab does a lot more than that right now. It features a really powerful CI/CD engine and even packs a docker registry. It has become an essential part of my development process. In this article, we will discuss setting up Gitlab for docker based developments.

We will start by setting up a VM in the cloud and installing Gitlab there. We will configure it to support HTTPS. We will also setup [Gitlab CI](https://about.gitlab.com/gitlab-ci/), the Continuous integration solution that comes with Gitlab with multiple runners to run the builds in parallel. We will also setup the docker registry to store our docker images and secure it with HTTPs. Finally we will test this setup with docker based project.

For the cloud VM, I'm using [Digital Ocean](https://www.digitalocean.com/), but the process is similar for other vendors as well. We will use [Let's Encrypt](https://letsencrypt.org/) for generating SSL certificates. To use this, you would also need a domain. The project used to test the gitlab setup is hosted [here](https://github.com/botleg/gitlab-nginx). It is simple project that build a docker image with [nginx](https://www.nginx.com/) webserver.

Create the VM
-------------

Create a VM using your cloud service, I am using Digital Ocean. You may also host Gitlab in your local system. I am choosing `Ubuntu 16.04 x64` as the OS, but any linux distro will work fine. Also, since we are putting the entire setup in one VM, make it with atleast 8GB of RAM.

We will register this Gitlab instance with a subdomain. Example: `gitlab.botleg.com`. Once you have created your created your VM, create a new `A` record in your DNS provider. The name will be subdomain name, `gitlab` here and provide the public IP of the VM. SSH into the VM created and create a new user. Follow [this](https://www.digitalocean.com/community/tutorials/initial-server-setup-with-ubuntu-16-04) tutorial to add this user and setup password-less access.


Installing Gitlab
-----------------

We will be using the Community Edition of Gitlab. All the features that we need in our development process is supported in this edition. A comparison of the editions can be found [here](https://about.gitlab.com/products/#compare-options). Easiest way to install Gitlab is to use the Omnibus package. It contains everything required for Gitlab in a single package with [Chef](https://www.chef.io/) recipes for the tasks.

Just follow the steps in [this](https://about.gitlab.com/downloads/#ubuntu1604) site to install it. You just have to install some dependencies, add the new repository and install the `gitlab-ce` package. The command `sudo gitlab-ctl reconfigure` triggers a chef receipe that reconfigures Gitlab based on the changes made to the configuration files.

Once this is done, you will able to go to the domain setup in DNS service and see Gitlab login page. You will be asked to set password for the default admin account named `root`. Set the admin password and login to Gitlab. Now, I recommend that you create a new admin user and use it for the next steps. This can be done from the Admin Area.


Enabling HTTPS
--------------

To enable HTTPS for Gitlab, we need to have a certificate generated for this domain. We will use `Let's Encrypt` for this. To know more about this, visit [here](https://letsencrypt.org/getting-started/). We will start by installing `Let's Encrypt` with,

{% highlight bash %}
sudo apt-get install letsencrypt
{% endhighlight %}

To create the certificate, we need to verify that we indeed own the domain. To do this, `letencrypt` tool provide a plugin `standalone` that creates a temporary web server and verifies the domain. So, for this to work, we need to temporarily disable gitlab. To do this, use the following commands and enter the domain name and email when prompted

{% highlight bash %}
sudo gitlab-ctl stop
sudo letsencrypt certonly --standalone --agree-tos
sudo gitlab-ctl start
{% endhighlight %}

The certificates generated will be in the folder `/etc/letsencrypt/live/<domain name>/`. The certificate file is `fullchain.pem` and the key is `privkey.pem`. We need to change this is in the Gitlab configurations. This file is located at `/etc/gitlab/gitlab.rb`. This file is full of comments. We will make a backup of this file and clear it,

{% highlight bash %}
sudo cp /etc/gitlab/gitlab.rb /etc/gitlab/gitlab.rb.bak
sudo truncate -s 0 /etc/gitlab/gitlab.rb
{% endhighlight %}

We need to add the following configuration items:

* `external_url`: The URL  where gitlab can be accessed. It will contain `https://` followed by the domain name.
* `nginx['redirect_http_to_https']`: We set it to `true` to redirect all HTTP traffic to HTTPS.
* `nginx['ssl_certificate']`: The location of the certificate file.
* `nginx['ssl_certificate_key']`: The location of the certificate key.

Open the file `/etc/gitlab/gitlab.rb` as root and enter the following lines.

{% highlight ruby %}
external_url 'https://<domain name>'
nginx['redirect_http_to_https'] = true

nginx['ssl_certificate'] = "/etc/letsencrypt/live/<domain name>/fullchain.pem"
nginx['ssl_certificate_key'] = "/etc/letsencrypt/live/<domain name>/privkey.pem"
{% endhighlight %}

Replace `<domain name>` with the domain name registered for Gitlab. Reconfigure Gitlab with new settings with the command,

{% highlight bash %}
sudo gitlab-ctl reconfigure
{% endhighlight %}

Now, when we go the Gitlab site, it will be in HTTPS with the `Let's Encrypt` certificate.


Gitlab CI Runners
-----------------

In this step, we will setup the runners needed to run the builds for CI/CD. The runners will build, test and publish the projects as defined by the `.gitlab-ci.yml` file. We will discuss more about this later. Since we are doing docker based projects, we will use docker images for runners and use `Docker inside Docker` for running our builds.

The first step for this would be to actually install docker engine in this server,

{% highlight bash %}
curl -sSL https://get.docker.com/ | sh
sudo usermod -aG docker $USER
{% endhighlight %}

The second command is to access docker without `sudo`. You might need to logout and login again to do this.Once we have the docker engine installed, we will run the [Gitlab CI Multi Runner](https://hub.docker.com/r/gitlab/gitlab-runner/) image. We will set the image to always restart if it goes down. With this implementation, we will share the docker engine in the server with the runner. For this, we will create a volume at the location, `/var/run/docker.sock`. To do all this, use the following command,

{% highlight bash %}
docker run -d --name runner1 --restart always -v /var/run/docker.sock:/var/run/docker.sock gitlab/gitlab-runner:latest
{% endhighlight %}

Here, `runner1` is the name of this runner. You can run multiple runners to run the builds in parallel. To run more runners, run the previous command by changing the name `runner1` to something else. Example: `docker run -d --name runner2 --restart always -v /var/run/docker.sock:/var/run/docker.sock gitlab/gitlab-runner:latest`, and so on.

To register these runners to Gitlab service, you need to have the registration token. You can find it in the `Runners` section of the Admin Area. Once you find this, run the following command,

{% highlight bash %}
docker exec -it runner1 gitlab-runner register
{% endhighlight %}

This command will ask the following things:

* `gitlab-ci coordinator URL`: It is the domain name of the gitlab service with `https://`, Example: `https://gitlab.botleg.com`.
* `gitlab-ci token`: Enter the registration token that we got from Gitlab site.
* `description`: Give a name from this runner. Example: `runner1`.
* `tags`: Give some tags to target this runner. Gitlab provide the option to run the tests on runner with certain tags.
* `run untagged builds`: Boolean value that tell whether this runner can accept jobs without tags. Since we have only one type of runners here, we can provide `true` for this.
* `executor`: How the jobs are executed by the runner. Here, we choose `docker`. To more about the other executors, check [here](https://gitlab.com/gitlab-org/gitlab-ci-multi-runner/blob/master/docs/executors/README.md).
* `default Docker image`: The docker image to run the tests in. We will user `docker:git` for this. This image allows for `docker in docker` and also has git inbuilt.

Repeat this command for all your runners by changing the runner name. Example: `docker exec -it runner2 gitlab-runner register`. After you do this, you will be able to see these runners in the `Runners` section of Gitlab's Admin Area.

There is however one more step we need to do. We are sharing the docker engine in the server to the runners. These runners will create `docker:git` image to run the jobs. These jobs build and push docker images. We will use the docker engine from the server to do this. So, we need to make a docker volume of `/var/run/docker.sock` for the `docker:git` images created by the runners to share the docker engine. To do this, we need to modify the configuration of each runner. Run the following command to open up the configuration file of the runner.

{% highlight bash %}
docker exec -it runner1 nano /etc/gitlab-runner/config.toml
{% endhighlight %}

Edit the line `volumes = ["/cache"]` to `volumes = ["/cache", "/var/run/docker.sock:/var/run/docker.sock"]`. The file will look something like this:

{% highlight toml %}
concurrent = 1
check_interval = 0

[[runners]]
  name = "runner1"
  url = "https://gitlab.botleg.com"
  token = "9ab32be14c9d2cb67fbec7aa59304f"
  executor = "docker"
  [runners.docker]
    tls_verify = false
    image = "docker:git"
    privileged = false
    disable_cache = false
    volumes = ["/cache", "/var/run/docker.sock:/var/run/docker.sock"]
  [runners.cache]
{% endhighlight %}

Repeat this step for other runners as well.


Container Registry
------------------

The final thing we need to setup is the [Container Registry](https://docs.gitlab.com/ce/user/project/container_registry.html). We will create a new sub-domain for registry, like `registry.botleg.com` and secure it using HTTPS. So, first thing would be to create a new `A` record with the DNS service. In this case, the name will be `registry` and give the public IP of the VM. Now, our server has `nginx` webserver. If the request is for `gitlab` subdomain, it will redirect to gitlab and if the request is for `registry`, it will redirect to registry.

We also need to create new SSL certificate for this `registry` sub-domain. As before, we use Let's Encrypt for this.

{% highlight bash %}
sudo gitlab-ctl stop
sudo letsencrypt certonly --standalone --agree-tos
sudo gitlab-ctl start
{% endhighlight %}

Provide the domain for the registry when prompted. This will create the new SSL certificates, which can be found in the `/etc/letsencrypt/live` folder. Update the gitlab configuration file `/etc/gitlab/gitlab.rb` to add the following lines.

{% highlight ruby %}
registry_external_url 'https://<domain name>'
registry_nginx['ssl_certificate'] = "/etc/letsencrypt/live/<domain name>/fullchain.pem"
registry_nginx['ssl_certificate_key'] = "/etc/letsencrypt/live/<domain name>/privkey.pem"
{% endhighlight %}

Replace `<domain name>` with the domain registered for the registry. This will enable registry with HTTPS enabled. To update the changes, use the `sudo gitlab-ctl reconfigure` command. In the Admin area you can see that the Container Registry is enabled. To test this out, try logging into the registry.

{% highlight ruby %}
docker login <registry domain>
{% endhighlight %}

Replace `<registry domain>` with the domain registered for the registry and provide the Gitlab username and password. You can see the `Login Succeeded` message.


Testing Setup
-------------

We have now setup the Gitlab for the docker based development. To test this implementation, we will push a git repository to Gitlab and see the working of Gitlab CI and Container Registry. I have made a simple docker based project which can be found [here](https://github.com/botleg/gitlab-nginx). This just contains a `Dockerfile` that installs `nginx` websever, which serves the `index.html` file.

The file that we are interested about is `.gitlab-ci.yml`. This contains all the information on how to build and deploy this project. To know more about this file, check [here](https://docs.gitlab.com/ce/ci/yaml/). The file for this project looks like this.

{% highlight ruby %}
image: docker:git

stages:
- build
- publish

build:
  stage: build
  script:
    - docker build -t $REGISTRY_HOST/$IMAGE_NAME .

registry:
  stage: publish
  script:
    - docker login -u gitlab-ci-token -p $CI_BUILD_TOKEN $REGISTRY_HOST
    - docker push $REGISTRY_HOST/$IMAGE_NAME
{% endhighlight %}

Since the job is docker based, we will specify the image to run this test on. The image, `docker:git` contains `docker` and `git` inside. We can split the entire process into multiple stages and each stage contains multiple jobs. Each job is a stage will be done in parallel and each stage will be triggered only if all jobs in the previous stage is successful.

Here, we have two stages, `build` and `publish`. The job `build` is in the `build` stage and job `registry` in the `publish` stage. So, `registry` job will be done only if the `build` job is successful. The `build` job contains a bash command to build the docker image. We can use variables in this script by prepending it with `$`. The values for this variables can be given from the Gitlab UI. The image name will be `$REGISTRY_HOST/$IMAGE_NAME`. Here, `$REGISTRY_HOST` is the registry domain name and `$IMAGE_NAME` will be the repository name.

In the `registry` job, we push this image to the container registry. To do this, we have to login to the registry. Gitlab has a temporary user named `gitlab-ci-token` with password in the variable `$CI_BUILD_TOKEN` for this purpose. Once with login to the registry at `$REGISTRY_HOST`, we can push the docker image.

To test this out, create a new public project in Gitlab by importing from Github. In the settings, choose `Variables` and add the following two variables.

* `REGISTRY_HOST`: The domain registered for container registry. Example: `registry.botleg.com`.
* `IMAGE_NAME`: The repository name for the project. Example: `botleg/gitlab-nginx`.

Once the repository is imported, goto the `Pipelines` tab and click the `Run Pipeline` button to trigger the build. You can see the jobs running and image being pushed to the registry. Once the build pipeline is complete, you can see the docker image in the `Registry` section of the project.


Certificate Renewal
-------------------

The certificates generated by Let's Encrypt will get expired in 90 days. So, we have to automate the renewal of these certificates. Let's Encrypt provide a command `letsencrypt renew` to do just this. This command will check if the certificates are about to be expired and do the renewal for those. For the renewal to happen, we need to stop the Gitlab service temporarily.

The following commands will do the renewal of the certificates,

{% highlight bash %}
gitlab-ctl stop
letsencrypt renew
gitlab-ctl start
gitlab-ctl reconfigure
{% endhighlight %}

We need to add this as a cron job for the `root` user. Open the crontab for `root` user with the command `sudo crontab -e` and paste the following line.

{% highlight cron %}
0 7 1 * * (gitlab-ctl stop && letsencrypt renew && gitlab-ctl start && gitlab-ctl reconfigure) >> /var/log/report.log 2>&1
{% endhighlight %}

This will cause this task to run at 7am on the 1st of every month and log the output to the file `/var/log/report.log`. Now, we have completely setup Gitlab for the docker based development and also tested it with a git repo.