import 'dart:async';

import 'package:class_mate/database/database.dart';
import 'package:class_mate/error_catcher.dart';
import 'package:class_mate/hooks/use_user.dart';
import 'package:flutter/foundation.dart';
import 'package:sentry/sentry_io.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

Future<void> configureSentryScope() async {
  final storeAttachment = IoSentryAttachment.fromPath(await getDbFilePath());

  Sentry.configureScope((scope) {
    scope.addAttachment(storeAttachment);
    scope.setUser(SentryUser(
      id: useOptionalUser()?.licenseKey,
      username: useOptionalUser()?.name,
    ));
  });
}

const disableSentryInDebug = true;

Future<void> prepareSentry(FutureOr<void> Function() appRunner) async {
  if (kDebugMode && disableSentryInDebug) {
    await appRunner();
    return;
  }

  await SentryFlutter.init(
    (options) {
      options.debug = kDebugMode;
      options.dsn = kDebugMode
          ? 'https://88c243baf29e4f57e48808fa4e11275a@o1058251.ingest.sentry.io/4505792632193024' // Dev sentry project
          : 'https://9c38643f60084e4b837838da8558bdfd@o1058251.ingest.sentry.io/4505198290927616'; // Prod sentry project
      // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
      // We recommend adjusting this value in production.
      options.tracesSampleRate = 1.0;
      options.addEventProcessor(EventCatcherProcessor());
    },
    appRunner: () async {
      await configureSentryScope();

      await appRunner();
    },
  );
}
