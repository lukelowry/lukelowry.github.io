# Collection file mtimes reflect checkout/build time, not substantive content changes.
# Omit optional lastmod values until author-maintained revision dates are available.
Jekyll::Hooks.register :site, :post_write do |site|
  sitemap = File.join(site.dest, 'sitemap.xml')
  if File.file?(sitemap)
    xml = File.read(sitemap)
    File.write(sitemap, xml.gsub(/<lastmod>[^<]*<\/lastmod>\s*/, ''))
  end
end
