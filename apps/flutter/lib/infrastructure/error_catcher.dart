import 'dart:async';
import 'dart:collection';

import 'package:class_mate/presentation/colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

enum FlashType { error, success }

class UserVisibleError {
  final String message;
  final String? details;
  final FlashType type;
  final bool sticky;

  UserVisibleError(this.message,
      {this.details, this.type = FlashType.error, this.sticky = false});
}

ScaffoldFeatureController<SnackBar, SnackBarClosedReason> showErrorWithScaffold(
    ScaffoldMessengerState scaffoldMessenger, UserVisibleError error) {
  final content = switch (error.type) {
    FlashType.error => SnackBar(
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              "Ein Fehler ist aufgetreten",
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              error.message,
              style: const TextStyle(
                color: Colors.white,
              ),
            ),
          ],
        ),
        backgroundColor: theme.error,
        duration: error.sticky
            ? const Duration(seconds: 999)
            : const Duration(seconds: 3)),
    FlashType.success => SnackBar(
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              error.message,
              style: const TextStyle(
                color: Colors.white,
              ),
            ),
          ],
        ),
        backgroundColor: theme.primary,
        duration: error.sticky
            ? const Duration(seconds: 999)
            : const Duration(seconds: 3)),
  };

  return scaffoldMessenger.showSnackBar(content);
}

ScaffoldFeatureController<SnackBar, SnackBarClosedReason>? showError(
    BuildContext context, UserVisibleError error) {
  try {
    final scaffoldMessenger = ScaffoldMessenger.of(context);
    return showErrorWithScaffold(scaffoldMessenger, error);
  } catch (e) {
    debugPrint("Error while showing error: $e");
    return null;
  }
}

class QueueNotifier extends ChangeNotifier {
  final _queue = Queue<String>();

  void add(String error) {
    _queue.add(error);
    notifyListeners();
  }

  String? get() {
    if (_queue.isNotEmpty) {
      final error = _queue.removeFirst();
      return error;
    } else {
      return null;
    }
  }
}

final errorQueue = QueueNotifier();

class EventCatcherProcessor extends EventProcessor {
  @override
  FutureOr<SentryEvent?> apply(SentryEvent event, {Hint? hint}) {
    for (final exception in event.exceptions ?? <SentryException>[]) {
      errorQueue.add(exception.throwable.toString().split("\n")[0]);
    }

    return event;
  }
}

class ErrorCatcher extends HookWidget {
  final Widget child;

  const ErrorCatcher({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    void handleError(String? error) {
      if (error != null) {
        showError(
            context,
            UserVisibleError(
              error,
              type: FlashType.error,
            ));
      }
    }

    useEffect(() {
      errorQueue.addListener(() {
        handleError(errorQueue.get());
      });
      handleError(errorQueue.get());
      return null;
    }, []);

    return child;
  }
}
