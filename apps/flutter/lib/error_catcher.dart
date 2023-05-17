import 'dart:async';
import 'dart:collection';

import 'package:class_mate/static/colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

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
    handleError(String? error) {
      if (error != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "Ein Fehler ist aufgetreten:",
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  error,
                  style: const TextStyle(
                    color: Colors.white,
                  ),
                ),
              ],
            ),
            backgroundColor: theme.error,
          ),
        );
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
