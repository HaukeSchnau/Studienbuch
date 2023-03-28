import 'package:class_companion/components/util/clip_shadow_path.dart';
import 'package:class_companion/components/util/clippers.dart';
import 'package:class_companion/static/colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class PathBackgroundPage extends HookWidget {
  final Widget child;

  const PathBackgroundPage({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;

    final scrollView = SingleChildScrollView(
      child: Container(
        color: theme.lightBg,
        child: Stack(children: [
          Container(color: theme.lightBg, height: screenHeight / 2),
          ClipShadowPath(
            shadow: Shadow(color: theme.secondary, offset: const Offset(0, 6)),
            clipper: BezierClipper(),
            child: Container(
              height: 250,
              color: theme.primary,
            ),
          ),
          SafeArea(child: child)
        ]),
      ),
    );

    return Stack(children: [
      Column(
        children: [
          Expanded(
            child: Container(color: theme.primary),
          ),
          Expanded(
            child: Container(color: theme.lightBg),
          )
        ],
      ),
      scrollView
    ]);
  }
}
