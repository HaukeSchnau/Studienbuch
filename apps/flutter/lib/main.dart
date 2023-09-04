import 'dart:async';

import 'package:class_mate/app.dart';
import 'package:class_mate/firebase_options.dart';
import 'package:class_mate/hooks/use_user.dart';
import 'package:class_mate/models/app_store.dart';
import 'package:class_mate/models/store.dart';
import 'package:class_mate/sentry.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';

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
  // TODO remove this when all users have migrated to the new store
  final legacyStore = await loadStore();
  if (legacyStore != null) {
    await legacyStore.init();
    await legacyStore.save();
    await legacyStore.retire();
  }

  await initUser();
  await store.init();

  runApp(const App());
}

Future<void> main() async {
  await prepare();

  await prepareSentry(appRunner);
}
