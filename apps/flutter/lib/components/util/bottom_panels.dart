import 'package:assorted_layout_widgets/assorted_layout_widgets.dart';
import 'package:class_companion/components/util/clippers.dart';
import 'package:class_companion/static/colors.dart';
import 'package:flutter/material.dart';

class BottomPanels extends StatelessWidget {
  final Widget blueChild;
  final Widget? whiteChild;
  final bool safeArea;

  const BottomPanels(
      {Key? key,
      required this.blueChild,
      this.whiteChild,
      this.safeArea = false})
      : super(key: key);

  @override
  Widget build(BuildContext context) {
    const radius = BorderRadius.vertical(top: Radius.circular(50));
    return ColumnSuper(
      innerDistance: -50,
      children: [
        BlueBg(
          radius: radius,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 24.0),
            child: blueChild,
          ),
        ),
        if (whiteChild != null)
          Container(
            width: MediaQuery.of(context).size.width,
            padding: const EdgeInsets.only(
                top: 32.0, bottom: 16, left: 32, right: 32),
            decoration:
                BoxDecoration(color: theme.lightBg, borderRadius: radius),
            child: whiteChild,
          )
      ],
    );
  }
}

class BlueBg extends StatelessWidget {
  final BorderRadius radius;
  final Widget child;

  const BlueBg({Key? key, this.radius = BorderRadius.zero, required this.child})
      : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned.fill(
          child: Container(
            width: MediaQuery.of(context).size.width,
            decoration:
                BoxDecoration(color: theme.secondary, borderRadius: radius),
          ),
        ),
        Positioned.fill(
          child: ClipPath(
            clipper: AufgabenClipper(),
            child: Container(
              width: MediaQuery.of(context).size.width,
              decoration: BoxDecoration(
                  color: const Color.fromRGBO(0, 0, 0, .1),
                  borderRadius: radius),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 50.0),
          child: child,
        )
      ],
    );
  }
}
