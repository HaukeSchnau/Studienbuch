import 'package:drift/drift.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

List<D>? useQuery<T extends HasResultSet, D>(
    SimpleSelectStatement<T, D> Function() createQuery,
    [List<Object?> keys = const []]) {
  final stream = useMemoized(() => createQuery().watch(), keys);
  final snapshot = useStream(stream);
  if (snapshot.hasError) {
    throw snapshot.error!;
  }
  return snapshot.data;
}

AsyncSnapshot<D?> useQuerySingle<T extends HasResultSet, D>(
    SimpleSelectStatement<T, D> Function() createQuery,
    [List<Object?> keys = const []]) {
  final stream = useMemoized(() => createQuery().watchSingleOrNull(), keys);
  final snapshot = useStream(stream);
  if (snapshot.hasError) {
    throw snapshot.error!;
  }
  return snapshot;
}

List<TypedResult>? useQueryJoin<T extends HasResultSet, D>(
    JoinedSelectStatement<T, D> Function() createQuery,
    [List<Object?> keys = const []]) {
  final stream = useMemoized(() => createQuery().watch(), keys);
  final snapshot = useStream(stream);
  if (snapshot.hasError) {
    throw snapshot.error!;
  }
  return snapshot.data;
}
