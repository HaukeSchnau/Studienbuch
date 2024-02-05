import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

T useDisposable<T extends ChangeNotifier>(T Function() createInitialValue) {
  final disposable = useMemoized(createInitialValue);
  useEffect(() {
    return () => disposable.dispose();
  }, [disposable]);
  return disposable;
}
