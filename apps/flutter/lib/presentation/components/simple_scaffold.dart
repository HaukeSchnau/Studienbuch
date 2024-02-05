import 'package:class_mate/infrastructure/error_catcher.dart';
import 'package:flutter/material.dart';

class SimpleScaffold extends StatelessWidget {
  final Widget body;
  final PreferredSizeWidget? appBar;
  final Widget? bottomNavigationBar;
  final bool scroll;

  const SimpleScaffold(
      {super.key, required this.body, this.scroll = false, this.appBar, this.bottomNavigationBar});

  @override
  Widget build(BuildContext context) {
    final child = scroll ? SingleChildScrollView(child: body) : body;

    return Scaffold(
        appBar: appBar,
        bottomNavigationBar: bottomNavigationBar,
        body: ErrorCatcher(
          child: child,
        ));
  }
}
