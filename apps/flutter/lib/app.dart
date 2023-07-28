import 'package:class_mate/hooks/use_notification_setup.dart';
import 'package:class_mate/models/store.dart';
import 'package:class_mate/router.dart';
import 'package:class_mate/static/colors.dart';
import 'package:class_mate/static/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class App extends HookWidget {
  final GlobalStore? initialStore;

  const App({super.key, this.initialStore});

  @override
  Widget build(BuildContext context) {
    useNotificationSetup();

    final store = useState<GlobalStore?>(initialStore);

    void updateStore(GlobalStore newStore) {
      store.value?.disableSaving();
      store.value = newStore;
      store.value?.updateStore = updateStore;
    }

    useEffect(() {
      store.value?.updateStore = updateStore;
      return null;
    }, []);

    final routerConfig =
        useMemoized(() => buildMainRouter(store, updateStore), [store.value]);

    return MaterialApp.router(
      routerConfig: routerConfig,
      title: 'IGS Lilienthal',
      theme: buildTheme(theme),
      debugShowCheckedModeBanner: false,
    );
  }
}
