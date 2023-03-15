import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

abstract class DataHookWidget<T> extends HookWidget {
  final T? data;
  final bool isLoading;

  const DataHookWidget({super.key, this.data, this.isLoading = false});

  @override
  Widget build(BuildContext context) {
    final data = this.data;
    if (data == null) {
      if (!isLoading) {
        debugPrint(
            "$runtimeType: Data is null. Did you forget to pass it to the constructor?");

        return const SizedBox();
      }

      return buildLoading(context);
    }

    return buildWithData(context, data);
  }

  Widget buildLoading(BuildContext context) {
    return const Center(child: CircularProgressIndicator());
  }

  Widget buildWithData(BuildContext context, T data);
}
