import 'package:flutter_hooks/flutter_hooks.dart';

T? useNetworkResult<T>(Future<T> Function() future, [List<Object?> keys = const []]) {
  final result = useState<T?>(null);
  useEffect(() {
    () async {
      result.value = await future();
    }();
    return null;
  }, keys);
  return result.value;
}
