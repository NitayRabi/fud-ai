/**
 * Expo config plugin: adopt UIScene life cycle required by iOS 26+/27.
 *
 * - Adds UIApplicationSceneManifest → EXExpoAppSceneDelegate to Info.plist
 * - Rewrites AppDelegate so it creates the RN factory but lets ExpoAppSceneDelegate
 *   create the window and start React Native (see ExpoAppSceneDelegate.swift).
 */
const {
  withDangerousMod,
  withInfoPlist,
  createRunOncePlugin,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const APP_DELEGATE = `internal import Expo
import React
import ReactAppDependencyProvider

/**
 * Scene-based AppDelegate (required on iOS 26+/27). The factory is created here;
 * \`ExpoAppSceneDelegate\` creates the window and starts React Native when the scene connects.
 */
@main
class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
`;

function withSceneInfoPlist(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return config;
  });
}

function withSceneAppDelegate(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosRoot = path.join(config.modRequest.platformProjectRoot);
      const entries = fs.readdirSync(iosRoot, { withFileTypes: true });
      const appDir = entries.find((e) => e.isDirectory() && fs.existsSync(path.join(iosRoot, e.name, 'AppDelegate.swift')));
      if (!appDir) {
        console.warn('[withIosSceneLifecycle] AppDelegate.swift not found; skip');
        return config;
      }
      const target = path.join(iosRoot, appDir.name, 'AppDelegate.swift');
      fs.writeFileSync(target, APP_DELEGATE);
      return config;
    },
  ]);
}

function withIosSceneLifecycle(config) {
  config = withSceneInfoPlist(config);
  config = withSceneAppDelegate(config);
  return config;
}

module.exports = createRunOncePlugin(withIosSceneLifecycle, 'withIosSceneLifecycle', '1.0.0');
