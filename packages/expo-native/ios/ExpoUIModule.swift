// Copyright 2025-present 650 Industries. All rights reserved.

import ExpoModulesCore

public class ExpoUIModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoUI")

    View(Button.self)
    View(PickerView.self)
    View(SwitchView.self)
    View(SectionView.self)
    View(BottomSheetView.self)
    View(SliderView.self)
    View(ExpoUI.ContextMenu.self)
    View(ExpoUI.ContextMenuActivationElement.self)
    View(ExpoUI.ContextMenuPreview.self)
    View(ColorPickerView.self)
    View(DateTimePickerView.self)
    View(TextInputView.self)
    View(ProgressView.self)
    View(GaugeView.self)
    View(ListView.self)
    View(LabelView.self)

    View(SwiftUIContainer.self)
    View(SwiftUIForm.self)
    View(SwiftUISection.self)
    View(SwiftUIHStack.self)
    View(SwiftUIVStack.self)
    View(SwiftUIText.self)
    View(SwiftUIButton.self)
    View(SwiftUIPicker.self)
    View(SwiftUISwitch.self)

    View(DrawingExpoView.self) {
        AsyncFunction("getSVG") { (view: DrawingExpoView) in
            return view.getSVG()
        }
    }

    View(SelectView.self) {
        Events("onSelect")
        
        // Defines a setter for the `name` prop.
        Prop("name") { (view: SelectView, prop: String) in
            view.button.menu = UIMenu(title: prop, children: view.button.menu?.children ?? [])
        }
        
        Prop("options") { (view: SelectView, prop: [String]) in
            view.button.menu = UIMenu(
                title: view.button.menu?.title ?? "",
                children: prop.enumerated().map { index, title in
                    UIAction(title: title, handler: { _ in
                        view.onSelect([
                            "index": index
                        ])
                    })
                }
            )
        }
    }
  }
}
