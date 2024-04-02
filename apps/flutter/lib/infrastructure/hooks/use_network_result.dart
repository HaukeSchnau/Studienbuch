import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

T? useNetworkResult<T>(Future<T> Function() future,
    void Function(Object cause, StackTrace? stackTrace) onError,
    [List<Object?> keys = const []]) {
  final result = useState<T?>(null);
  useEffect(() {
    () async {
      try {
        result.value = await future();
      } on Error catch (e) {
        debugPrint(e.toString());
        onError(e, e.stackTrace);
      } catch (e) {
        debugPrint(e.toString());
        onError(e, null);
      }
    }();
    return null;
  }, keys);
  return result.value;
}
