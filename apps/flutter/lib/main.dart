import 'dart:async';

import 'package:class_mate/error_catcher.dart';
import 'package:class_mate/models/store.dart';
import 'package:class_mate/router.dart';
import 'package:class_mate/static/colors.dart';
import 'package:class_mate/static/theme.dart';
import 'package:class_mate/trial.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

Future<void> appRunner() async {
  final store = await loadStore();
  if (store != null) {
    await store.init();
  }

  runApp(App(initialStore: store));
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  Intl.defaultLocale = "de_DE";
  await initializeDateFormatting("de_DE", null);

  if (kDebugMode) {
    await appRunner();
  } else {
    await SentryFlutter.init(
      (options) {
        options.dsn =
            'https://9c38643f60084e4b837838da8558bdfd@o1058251.ingest.sentry.io/4505198290927616';
        // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
        // We recommend adjusting this value in production.
        options.tracesSampleRate = 1.0;
        options.addEventProcessor(EventCatcherProcessor());
      },
      appRunner: appRunner,
    );
  }
}

class App extends HookWidget {
  final GlobalStore? initialStore;

  const App({super.key, this.initialStore});

  @override
  Widget build(BuildContext context) {
    final store = useState<GlobalStore?>(initialStore);

    void updateStore(GlobalStore newStore) {
      store.value = newStore;
      store.value?.updateStore = updateStore;
    }

    useEffect(() {
      store.value?.updateStore = updateStore;
      return null;
    }, []);

    final router = useMemoized(
        () => isTrial
            ? buildMainRouter(store, updateStore)
            : buildTrialOverRouter(),
        [store.value, isTrial]);

    return MaterialApp.router(
      routerConfig: router,
      title: 'IGS Lilienthal',
      theme: buildTheme(theme),
      debugShowCheckedModeBanner: false,
    );
  }
}
