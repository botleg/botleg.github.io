FROM jekyll/jekyll

RUN apk add --update --no-cache autoconf build-base nasm libpng-dev imagemagick

COPY Gemfile /srv
RUN cd /srv && bundle install

RUN mkdir -p /srv/node
COPY gulp /srv/node
RUN cd /srv/node && npm install

COPY run.sh /bin
RUN chmod +x /bin/run.sh

COPY jekyll /srv/jekyll
WORKDIR /srv/node
ENTRYPOINT /bin/run.sh