import { NativeModulesProxy, EventEmitter, Subscription } from 'expo-modules-core';

// Import the native module. On web, it will be resolved to StuNativeModules.web.ts
// and on native platforms to StuNativeModules.ts
import StuNativeModulesModule from './StuNativeModulesModule';
import StuNativeModulesView from './StuNativeModulesView';
import { ChangeEventPayload, StuNativeModulesViewProps } from './StuNativeModules.types';

// Get the native constant value.
export const PI = StuNativeModulesModule.PI;

export function hello(): string {
  return StuNativeModulesModule.hello();
}

export async function setValueAsync(value: string) {
  return await StuNativeModulesModule.setValueAsync(value);
}

const emitter = new EventEmitter(StuNativeModulesModule ?? NativeModulesProxy.StuNativeModules);

export function addChangeListener(listener: (event: ChangeEventPayload) => void): Subscription {
  return emitter.addListener<ChangeEventPayload>('onChange', listener);
}

export { StuNativeModulesView, StuNativeModulesViewProps, ChangeEventPayload };
