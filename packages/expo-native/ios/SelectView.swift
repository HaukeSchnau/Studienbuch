import ExpoModulesCore
import UIKit

class SelectView: ExpoView {
    let button = UIButton(type: .system)
    let onSelect = EventDispatcher()

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        clipsToBounds = true
        insertSubview(button, at: 0)

        button.backgroundColor = backgroundColor

        button.showsMenuAsPrimaryAction = true
    }
    
    override func addSubview(_ view: UIView) {
        button.addSubview(view)
    }

    override func layoutSubviews() {
        button.frame = bounds
    }
}
