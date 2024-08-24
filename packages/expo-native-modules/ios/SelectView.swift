import ExpoModulesCore
import UIKit

class SelectView: ExpoView { 
    let button = UIButton(type: .system)

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        clipsToBounds = true
        addSubview(button)

        button.setTitle("Click Me", for: .normal)
        button.setTitleColor(.white, for: .normal)
        button.backgroundColor = backgroundColor
        button.layer.cornerRadius = borderRadius

        let menu = UIMenu(title: "Mathe", children: [
            UIAction(title: "Option 1", handler: { _ in
                print("Option 1 selected")
            }),
            UIAction(title: "Option 2", handler: { _ in
                print("Option 2 selected")
            }),
            UIAction(title: "Option 3", handler: { _ in
                print("Option 3 selected")
            })
        ])
        button.menu = menu

        button.changesSelectionAsPrimaryAction = true
        button.showsMenuAsPrimaryAction = true

        button.addTarget(self, action: #selector(buttonTapped), for: .touchUpInside)
    }

    override func layoutSubviews() {
        button.frame = bounds
    }
    
    // Function to handle button tap
    @objc func buttonTapped() {
        print("Button was tapped!")
    }

    // Function to get the button instance
    func getButton() -> UIButton {
        return button
    }
}
