import { StyleSheet, Text, View } from 'react-native';

import * as StuNativeModules from '@stu/expo-native-modules';

export default function App() {
  return (
    <View style={styles.container}>
      <Text>{StuNativeModules.hello()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
