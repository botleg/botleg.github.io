desc "real time building the site"
task :default do
  system "bundle exec compass compile"
  system "bundle exec jekyll build --watch --future & bundle exec compass watch & browser-sync start --port 4000 --server _site/ --files '**/*'"
end