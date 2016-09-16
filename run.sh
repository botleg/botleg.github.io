#!/bin/sh

npm start js compass img
bundle exec jekyll build --watch -s /srv/jekyll -d /srv/site &
npm start