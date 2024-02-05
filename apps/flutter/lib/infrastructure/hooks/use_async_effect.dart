import 'dart:async';
import 'package:flutter_hooks/flutter_hooks.dart';

void useAsyncEffect(
  FutureOr<void> Function() effect, [
  List<Object?>? keys,
]) {
  useEffect(() {
    effect();
    return null;
  }, keys);
}
