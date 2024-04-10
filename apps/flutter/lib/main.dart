import 'dart:async';

import 'package:class_mate/infrastructure/app.dart';
import 'package:class_mate/infrastructure/firebase_options.dart';
import 'package:class_mate/business_domain/user/use_user.dart';
import 'package:class_mate/models/app_store.dart';
import 'package:class_mate/infrastructure/sentry.dart';
import 'package:class_mate/features/sync/sync_service.dart';
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
  await initUser();
  await store.init();

  safeSyncTimetableData();

  runApp(const App());
}

Future<void> main() async {
  await prepare();

  await prepareSentry(appRunner);
}
