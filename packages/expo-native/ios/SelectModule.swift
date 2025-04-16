import ExpoModulesCore

public class SelectModule: Module {
    // Each module class must implement the definition function. The definition consists of components
    // that describes the module's functionality and behavior.
    // See https://docs.expo.dev/modules/module-api for more details about available components.
    public func definition() -> ModuleDefinition {
        // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
        // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
        // The module will be accessible from `requireNativeModule('StuNativeModules')` in JavaScript.
        Name("SelectModule")
        
        // Enables the module to be used as a native view. Definition components that are accepted as part of the
        // view definition: Prop, Events.
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
