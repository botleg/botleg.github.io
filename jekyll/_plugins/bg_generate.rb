module Jekyll
  class BGGenerator < Generator
    safe true

    def generate(site)
      site.config['bg'] = site.posts.docs.reverse[0].data['bg']        
    end
  end
end