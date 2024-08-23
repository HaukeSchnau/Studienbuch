import * as React from 'react';

import { StuNativeModulesViewProps } from './StuNativeModules.types';

export default function StuNativeModulesView(props: StuNativeModulesViewProps) {
  return (
    <div>
      <span>{props.name}</span>
    </div>
  );
}
