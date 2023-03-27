import 'package:drift/drift.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

List<D> useQuery<T extends HasResultSet, D>(
    SimpleSelectStatement<T, D> Function() createQuery,
    [List<Object?> keys = const []]) {
  final stream = useMemoized(() => createQuery().watch(), keys);
  final snapshot = useStream(stream);
  return snapshot.data ?? [];
}
