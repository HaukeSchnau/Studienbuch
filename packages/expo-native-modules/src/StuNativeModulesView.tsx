import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';

import { StuNativeModulesViewProps } from './StuNativeModules.types';

const NativeView: React.ComponentType<StuNativeModulesViewProps> =
  requireNativeViewManager('StuNativeModules');

export default function StuNativeModulesView(props: StuNativeModulesViewProps) {
  return <NativeView {...props} />;
}
