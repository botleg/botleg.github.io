module Jekyll
  class UnpinnedGenerator < Generator
    safe true

    def generate(site)
      posts = Array.new
      pinned = site.config['pinned']
      site.posts.reverse.each do |post|
        if post.tags.include? 'popular' and pinned > 0
          pinned -= 1
        else
          posts << post
        end
      end
        
      site.config['unpinned'] = posts
    end
  end
end