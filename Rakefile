desc "real time building the site"
task :default do
  system "bundle exec compass compile"
  system "bundle exec jekyll serve & bundle exec compass watch"
end