import 'package:class_mate/business_domain/user/use_user.dart';
import 'package:class_mate/infrastructure/hooks/use_notification_setup.dart';
import 'package:class_mate/router.dart';
import 'package:class_mate/presentation/colors.dart';
import 'package:class_mate/presentation/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class App extends HookWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    useNotificationSetup();

    final user = useOptionalUser();
    final routerConfig =
        useMemoized(() => buildMainRouterConfig(user), [user]);

    return MaterialApp.router(
      routerConfig: routerConfig,
      title: 'IGS Lilienthal',
      theme: buildTheme(theme),
      debugShowCheckedModeBanner: false,
    );
  }
}
