require 'digest'

module Jekyll
  module CacheBust
    def bust_file_cache(url)
      site = @context.registers[:site]
      relative = url.to_s.split('?').first.match(%r{(?:^|/)(assets/.*)$})&.captures&.first
      return url unless relative

      path = File.expand_path(relative, site.source)
      return url unless path.start_with?(File.expand_path('assets', site.source) + File::SEPARATOR)

      versioned_asset(url, Digest::SHA256.file(path).hexdigest)
    end

    def bust_css_cache(url)
      site = @context.registers[:site]
      digest = Digest::SHA256.new
      # main.scss contains the Liquid max-width setting; include it and its input.
      digest << site.config['max_width'].to_s
      paths = [File.join(site.source, 'assets/css/main.scss')]
      paths.concat(Dir.glob(File.join(site.source, '_sass/**/*.scss')).sort)
      paths.each do |path|
        digest << path.delete_prefix(site.source) << "\0" << File.binread(path)
      end
      versioned_asset(url, digest.hexdigest)
    end

    private

    def versioned_asset(url, digest)
      "#{url}#{url.include?('?') ? '&' : '?'}#{digest[0, 16]}"
    end
  end
end

Liquid::Template.register_filter(Jekyll::CacheBust)
