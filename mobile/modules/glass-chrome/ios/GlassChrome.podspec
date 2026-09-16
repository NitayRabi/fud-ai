Pod::Spec.new do |s|
  s.name           = 'GlassChrome'
  s.version        = '1.0.0'
  s.summary        = 'Liquid Glass chrome for the Fud AI React Native app (iOS only).'
  s.description    = 'Wraps UIGlassEffect (iOS 26+) with a UIVisualEffectView material fallback so shared React Native screens get native iOS glass for bars and floating controls.'
  s.author         = 'Apoorv Darshan'
  s.homepage       = 'https://github.com/apoorvdarshan/fud-ai'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
