
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

T? useNetworkResult<T>(Future<T> Function() future, void Function(Object cause)? onError,
    [List<Object?> keys = const []]) {
  final result = useState<T?>(null);
  useEffect(() {
    () async {
      try {
        result.value = await future();
      } catch (e) {
        if (onError != null) {
          debugPrint(e.toString());
          onError(e);
        } else {
          rethrow;
        }
      }
    }();
    return null;
  }, keys);
  return result.value;
}
