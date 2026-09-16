import ExpoModulesCore
import UIKit

/// A container whose background is native glass. React children are laid out on top of the
/// effect view, so the JS side controls content while UIKit owns the material.
final class GlassChromeView: ExpoView {
  private let effectView = UIVisualEffectView(effect: nil)

  var tintHex: String? {
    didSet { applyEffect() }
  }

  var isInteractive = false {
    didSet { applyEffect() }
  }

  var cornerRadius: CGFloat = 0 {
    didSet {
      layer.cornerRadius = cornerRadius
      layer.cornerCurve = .continuous
      effectView.layer.cornerRadius = cornerRadius
      effectView.layer.cornerCurve = .continuous
    }
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    effectView.clipsToBounds = true
    addSubview(effectView)
    applyEffect()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    effectView.frame = bounds
    // Fabric mounts React children by index; keep the material underneath regardless.
    sendSubviewToBack(effectView)
  }

  private func applyEffect() {
    if #available(iOS 26.0, *) {
      // Same construction as FoodResultView.swift in the native app.
      let glass = UIGlassEffect(style: .regular)
      glass.isInteractive = isInteractive
      glass.tintColor = tintHex.flatMap(UIColor.init(hexString:))
      effectView.effect = glass
    } else {
      effectView.effect = UIBlurEffect(style: .systemUltraThinMaterial)
    }
  }
}

private extension UIColor {
  convenience init?(hexString: String) {
    var hex = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
    if hex.hasPrefix("#") { hex.removeFirst() }
    guard hex.count == 6 || hex.count == 8, let value = UInt64(hex, radix: 16) else { return nil }
    let hasAlpha = hex.count == 8
    let r = CGFloat((value >> (hasAlpha ? 24 : 16)) & 0xFF) / 255
    let g = CGFloat((value >> (hasAlpha ? 16 : 8)) & 0xFF) / 255
    let b = CGFloat((value >> (hasAlpha ? 8 : 0)) & 0xFF) / 255
    let a = hasAlpha ? CGFloat(value & 0xFF) / 255 : 1
    self.init(red: r, green: g, blue: b, alpha: a)
  }
}
