/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { requireNativeView } from "expo";
import { Children, useMemo } from "react";
import type { NativeSyntheticEvent } from "react-native";

import type { ContextMenuProps, EventHandlers, NativeMenuProps } from ".";
import { transformChildrenToElementArray } from "./utils";

const MenuNativeView: React.ComponentType<NativeMenuProps> = requireNativeView(
  "ExpoUI",
  "ContextMenu",
);

export function Submenu() {
  return <></>;
}

export function Items() {
  return <></>;
}
Items.tag = "Items";

export function Trigger(_props: { children: React.ReactNode }) {
  return <></>;
}
Trigger.tag = "Trigger";

export function Preview(_props: { children: React.ReactNode }) {
  return <></>;
}

function ContextMenu(props: ContextMenuProps) {
  const eventHandlersMap: EventHandlers = {};
  const initialChildren = Children.map(
    props.children as any,
    (c: { type: { tag: string }; props: { children: React.ReactNode } }) =>
      c.type.tag === Items.tag ? c.props.children : null,
  );
  const processedElements = useMemo(
    () => transformChildrenToElementArray(initialChildren, eventHandlersMap),
    [initialChildren],
  );

  const activationElement = Children.map(
    props.children as any,
    (c: { type: { tag: string }; props: { children: React.ReactNode } }) =>
      c.type.tag === Trigger.tag ? c.props.children : null,
  );

  const createEventHandler =
    (handlerType: string) =>
    (e: NativeSyntheticEvent<{ contextMenuElementID: string }>) => {
      const handler =
        eventHandlersMap[e.nativeEvent.contextMenuElementID]?.[handlerType];
      handler?.(e);
    };

  return (
    <MenuNativeView
      style={props.style}
      elements={processedElements}
      onContextMenuButtonPressed={createEventHandler("onPress")}
      onContextMenuSwitchValueChanged={createEventHandler("onValueChange")}
      onContextMenuPickerOptionSelected={createEventHandler("onOptionSelected")}
      {...props}
    >
      {activationElement}
    </MenuNativeView>
  );
}

ContextMenu.Trigger = Trigger;
ContextMenu.Preview = Preview;
ContextMenu.Items = Items;

export { ContextMenu };
