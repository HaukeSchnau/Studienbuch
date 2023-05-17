import 'dart:ui';

import 'package:flutter_hooks/flutter_hooks.dart';

T? useNetworkResult<T>(Future<T> Function() future, VoidCallback? onError,
    [List<Object?> keys = const []]) {
  final result = useState<T?>(null);
  useEffect(() {
    () async {
      try {
        result.value = await future();
      } catch (e) {
        if (onError != null) {
          onError();
        } else {
          rethrow;
        }
      }
    }();
    return null;
  }, keys);
  return result.value;
}
