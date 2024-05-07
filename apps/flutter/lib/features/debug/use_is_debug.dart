import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:shared_preferences/shared_preferences.dart';

ValueNotifier<bool> _debug = ValueNotifier(false);

bool useIsDebug() {
  final future = useMemoized(SharedPreferences.getInstance);
  final snapshot = useFuture(future, initialData: null);

  useEffect(() {
    if (snapshot.data != null) {
      _debug.value = snapshot.data?.getBool("debug") ?? false;
    }
    return null;
  }, [snapshot.data]);

  return useValueListenable(_debug);
}

Future<void> setDebug(bool value) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setBool("debug", value);

  _debug.value = value;
}
