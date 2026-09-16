import ExpoModulesCore

/// iOS-only bridge for Liquid Glass chrome. Android intentionally has no counterpart: the shared
/// React Native screens render the same layout and colors there without a glass material.
public class GlassChromeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GlassChrome")

    Constants([
      "isLiquidGlassAvailable": Self.isLiquidGlassAvailable
    ])

    View(GlassChromeView.self) {
      Prop("tint") { (view: GlassChromeView, tint: String?) in
        view.tintHex = tint
      }

      Prop("interactive") { (view: GlassChromeView, interactive: Bool) in
        view.isInteractive = interactive
      }

      Prop("cornerRadius") { (view: GlassChromeView, radius: Double) in
        view.cornerRadius = CGFloat(radius)
      }
    }
  }

  private static var isLiquidGlassAvailable: Bool {
    if #available(iOS 26.0, *) {
      return true
    }
    return false
  }
}
