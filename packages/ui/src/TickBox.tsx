import { StyleSheet, View } from "react-native";

import { Vector } from "./Vector.tsx";
import { Wipe } from "./Wipe.tsx";

export interface TickBoxProps {
  readonly checked: boolean;
  readonly color: string;
  readonly size?: number;
}

/**
 * Direction D's pen: a box drawn by hand, and a tick that draws itself once when the box gets
 * checked and leaves it at the top right. The pressable around it carries the role and the label.
 */
export function TickBox({ checked, color, size = 30 }: TickBoxProps) {
  return (
    <View style={{ width: size, height: size }}>
      <Vector
        width={size}
        height={size}
        viewBox="0 0 32 32"
        paths={[{ d: pen.box, stroke: color, strokeWidth: 2.2 }]}
      />
      {checked ? (
        <Wipe width={size} height={size} delay={0} duration={350} style={styles.tick}>
          <Vector
            width={size}
            height={size}
            viewBox="0 0 32 32"
            paths={[{ d: pen.tick, stroke: color, strokeWidth: 3.2 }]}
          />
        </Wipe>
      ) : null}
    </View>
  );
}

const pen = {
  box: "M4.5 5.2C10 4 21 4.6 27.2 4.4C27.8 11 27.3 20 27.9 27.2C20.5 27.9 11 27.3 4.2 27.8C3.6 20.5 4.9 12 4.5 5.2Z",
  tick: "M8 16.5C10.5 18.5 12 20.5 13.5 23.5C16.5 16 21 10 28 5",
};

const styles = StyleSheet.create({ tick: { position: "absolute", left: 0, top: 0 } });
