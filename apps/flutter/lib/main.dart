import 'package:class_companion/models/store.dart';
import 'package:class_companion/pages/about_page.dart';
import 'package:class_companion/pages/root_page.dart';
import 'package:class_companion/pages/welcome_page.dart';
import 'package:class_companion/static/colors.dart';
import 'package:class_companion/static/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  Intl.defaultLocale = "de_DE";

  const reinit = true;
  if (reinit) {
    runApp(const App());
  }

  final store = await loadStore();
  runApp(App(initialStore: store));
}

typedef SetupFinishedCallback = void Function(GlobalStore store);

class App extends HookWidget {
  final GlobalStore? initialStore;

  const App({Key? key, this.initialStore}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final store = useState<GlobalStore?>(initialStore);

    void onSetupFinished(GlobalStore newStore) {
      store.value = newStore;
    }

    final router = useMemoized(
        () => GoRouter(
              routes: [
                GoRoute(
                  path: '/',
                  builder: (context, state) {
                    final val = store.value;
                    if (val != null) {
                      return Provider(
                        create: (_) => val,
                        child: const RootPage(),
                      );
                    } else {
                      return Provider(
                        create: (_) => onSetupFinished,
                        child: const WelcomePage(),
                      );
                    }
                  },
                ),
                GoRoute(
                  path: '/about',
                  builder: (context, state) => const AboutPage(),
                ),
                GoRoute(
                    path: "/setup/license-key",
                    builder: (context, state) => Provider(
                          create: (_) => onSetupFinished,
                          child: const WelcomePage(),
                        )),
              ],
            ),
        [store.value]);

    return MaterialApp.router(
        routerConfig: router,
        title: 'IGS Lilienthal',
        theme: buildTheme(getDefaultTheme()),
        debugShowCheckedModeBanner: false,
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [
          Locale('de', 'DE'),
        ]);
  }
}
