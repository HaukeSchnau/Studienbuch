import 'dart:async';

import 'package:class_mate/firebase_options.dart';
import 'package:class_mate/infrastructure/api.dart';
import 'package:class_mate/infrastructure/app.dart';
import 'package:class_mate/business_domain/user/use_user.dart';
import 'package:class_mate/models/agenda_store.dart';
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

  await api.init();

  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
}

void reloadSubstitutionsInBackground() {
  agendaStore.loadSubstitutionsForCurrentAgenda(reportNetworkError: false);
}

// Runs after sentry is initialized
Future<void> appRunner() async {
  await initUser();
  await agendaStore.init();

  Timer.periodic(
      const Duration(seconds: 30), (_) => reloadSubstitutionsInBackground());

  AppLifecycleListener(
      onShow: reloadSubstitutionsInBackground,
      onResume: reloadSubstitutionsInBackground,
      onRestart: reloadSubstitutionsInBackground);

  safeSyncTimetableData();

  runApp(const App());
}

Future<void> main() async {
  await prepare();

  await prepareSentry(appRunner);
}
