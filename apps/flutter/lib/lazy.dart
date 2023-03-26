import 'package:flutter/foundation.dart';

abstract class Lazy<T> {
  T get value;
  Future<void> load();
}

class LazyReference<T> extends ValueNotifier<T?> with Lazy<T?> {
  final Future<T> Function() _load;

  LazyReference(this._load) : super(null);

  @override
  Future<void> load() async {
    value = await _load();
  }
}

class LazyList<T> extends ValueNotifier<List<T>> with Lazy<List<T>> {
  final Future<List<T>> Function() _load;
  bool _loaded = false;

  LazyList(this._load) : super([]);

  @override
  Future<void> load() async {
    if (_loaded) {
      return;
    }
    _loaded = true;
    value = await _load();
  }
}
