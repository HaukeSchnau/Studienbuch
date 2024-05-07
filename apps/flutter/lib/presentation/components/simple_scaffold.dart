import 'package:class_mate/features/debug/use_is_debug.dart';
import 'package:class_mate/infrastructure/api.dart';
import 'package:class_mate/infrastructure/error_catcher.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class SimpleScaffold extends HookWidget {
  final Widget body;
  final PreferredSizeWidget? appBar;
  final Widget? bottomNavigationBar;
  final bool scroll;

  const SimpleScaffold(
      {super.key,
      required this.body,
      this.scroll = false,
      this.appBar,
      this.bottomNavigationBar});

  @override
  Widget build(BuildContext context) {
    final child = scroll ? SingleChildScrollView(child: body) : body;
    final isDebug = useIsDebug();

    final childWithDebug = isDebug ? DebugInfo(child: child) : child;

    return Scaffold(
        appBar: appBar,
        bottomNavigationBar: bottomNavigationBar,
        body: ErrorCatcher(child: childWithDebug));
  }
}

class DebugInfo extends HookWidget {
  final Widget child;

  const DebugInfo({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final server = useListenable(api.baseUriListenable);

    return Stack(
      children: [
        child,
        IgnorePointer(
          child: SafeArea(
              child: Align(
                  alignment: Alignment.topRight,
                  child: Padding(
                      padding: const EdgeInsets.all(8),
                      child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                              color: Colors.black.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(4)),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text("Server:",
                                  style: TextStyle(color: Colors.white)),
                              Text(
                                server.value.toString(),
                                style: const TextStyle(
                                  fontSize: 10,
                                  color: Colors.white,
                                ),
                              )
                            ],
                          ))))),
        ),
      ],
    );
  }
}
