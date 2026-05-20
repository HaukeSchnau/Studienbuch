import ExpoModulesCore
import UIKit

class StudienbuchNativeBadgeView: ExpoView {
  private let label = UILabel()
  private var accent = UIColor(red: 0.43, green: 0.72, blue: 0.41, alpha: 1)

  var title: String = "Native component" {
    didSet {
      label.text = title
    }
  }

  var accentColor: String = "#6DB868" {
    didSet {
      accent = UIColor(hexString: accentColor) ?? UIColor(red: 0.43, green: 0.72, blue: 0.41, alpha: 1)
      updateAppearance()
    }
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true

    label.text = title
    label.textAlignment = .center
    label.font = .preferredFont(forTextStyle: .headline)
    label.adjustsFontForContentSizeCategory = true
    addSubview(label)

    updateAppearance()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    label.frame = bounds.insetBy(dx: 12, dy: 0)
    layer.cornerRadius = 14
  }

  private func updateAppearance() {
    backgroundColor = accent.withAlphaComponent(0.12)
    layer.borderColor = accent.cgColor
    layer.borderWidth = 1
    label.textColor = accent
  }
}

private extension UIColor {
  convenience init?(hexString: String) {
    var hex = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
    if hex.hasPrefix("#") {
      hex.removeFirst()
    }

    guard hex.count == 6, let value = Int(hex, radix: 16) else {
      return nil
    }

    self.init(
      red: CGFloat((value >> 16) & 0xff) / 255,
      green: CGFloat((value >> 8) & 0xff) / 255,
      blue: CGFloat(value & 0xff) / 255,
      alpha: 1
    )
  }
}
