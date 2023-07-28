import 'dart:async';

import 'package:class_mate/error_catcher.dart';
import 'package:class_mate/firebase_options.dart';
import 'package:class_mate/hooks/use_async_effect.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/store.dart';
import 'package:class_mate/openapi.dart';
import 'package:class_mate/router.dart';
import 'package:class_mate/static/colors.dart';
import 'package:class_mate/static/theme.dart';
import 'package:class_mate_api/api.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

Future<void> prepare() async {
  WidgetsFlutterBinding.ensureInitialized();

  Intl.defaultLocale = "de_DE";
  await initializeDateFormatting("de_DE", null);

  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
}

Future<void> appRunner() async {
  final store = await loadStore();
  if (store != null) {
    await store.init();
  }

  runApp(App(initialStore: store));
}

Future<void> main() async {
  await prepare();

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

bool hasStartMessagingRequest = false;

class App extends HookWidget {
  final GlobalStore? initialStore;

  const App({super.key, this.initialStore});

  @override
  Widget build(BuildContext context) {
    final courses = useCourses();

    useAsyncEffect(() async {
      if (courses == null || courses.isEmpty || hasStartMessagingRequest) {
        return;
      }

      hasStartMessagingRequest = true;

      FirebaseMessaging messaging = FirebaseMessaging.instance;

      NotificationSettings settings = await messaging.requestPermission(
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: false,
        provisional: false,
        sound: true,
      );

      debugPrint('User granted permission: ${settings.authorizationStatus}');
      if (settings.authorizationStatus != AuthorizationStatus.authorized) {
        return;
      }

      final token = await messaging.getToken();
      if (token == null) {
        return;
      }

      await apiInstance
          .mutationSubscriptionsSubscribe(MutationSubscriptionsSubscribeRequest(
        messagingToken: token,
        courses: courses.map((course) => course.id).toList(),
      ));

      hasStartMessagingRequest = false;
    }, [courses]);

    return StoreManagingApp(
      initialStore: initialStore,
    );
  }
}

class StoreManagingApp extends HookWidget {
  final GlobalStore? initialStore;

  const StoreManagingApp({super.key, this.initialStore});

  @override
  Widget build(BuildContext context) {
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

    final router =
        useMemoized(() => buildMainRouter(store, updateStore), [store.value]);

    return MaterialApp.router(
      routerConfig: router,
      title: 'IGS Lilienthal',
      theme: buildTheme(theme),
      debugShowCheckedModeBanner: false,
    );
  }
}
