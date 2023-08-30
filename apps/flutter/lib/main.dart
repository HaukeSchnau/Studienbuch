import 'dart:async';

import 'package:class_mate/app.dart';
import 'package:class_mate/firebase_options.dart';
import 'package:class_mate/models/store.dart';
import 'package:class_mate/sentry.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';
import 'package:sentry/sentry.dart';

// Runs before sentry is initialized
Future<void> prepare() async {
  WidgetsFlutterBinding.ensureInitialized();

  Intl.defaultLocale = "de_DE";
  await initializeDateFormatting("de_DE", null);

  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
}

// Runs after sentry is initialized
Future<void> appRunner() async {
  final store = await loadStore();
  if (store != null) {
    await store.init();
  } else {
    Sentry.captureMessage(
      "No store found. This might be the first time the app is started. Creating a new store. This should only happen once per device.",
    );
  }

  runApp(App(initialStore: store));
}

Future<void> main() async {
  await prepare();
  await prepareSentry(appRunner);
}
