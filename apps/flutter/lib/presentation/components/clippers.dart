import 'dart:math';

import 'package:class_mate/infrastructure/util/math_util.dart';
import 'package:flutter/widgets.dart';

class BezierClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    Path path = Path();
    path.lineTo(0, size.height);
    path.cubicTo(size.width * 0.5, size.height * .9, size.width * 0.5,
        size.height, size.width * 0.7, size.height * 0.6);
    path.cubicTo(size.width * .8, size.height * 0.4, size.width,
        size.height * 0.4, size.width, size.height * 0.4);
    path.lineTo(size.width, 0);
    return path;
  }

  @override
  bool shouldReclip(CustomClipper<Path> oldClipper) {
    return true;
  }
}

class AufgabenClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    Path path = Path();
    path.moveTo(0, size.height * .6);
    Point p1 = Point(size.width * .4, size.height * .65);
    Point control1 = fromDistanceDeg(p1, 120, 120);
    Point control2 = fromDistanceDeg(p1, 120 + 180.0, 120);
    Point p2 = Point(size.width * .8, size.height * .4);
    Point control3 = fromDistanceDeg(p2, 120, 80);
    Point control4 = fromDistanceDeg(p2, 120 + 180.0, 80);
    path.quadraticBezierTo(control1.x.toDouble(), control1.y.toDouble(),
        p1.x.toDouble(), p1.y.toDouble());
    path.cubicTo(
        control2.x.toDouble(),
        control2.y.toDouble(),
        control3.x.toDouble(),
        control3.y.toDouble(),
        p2.x.toDouble(),
        p2.y.toDouble());
    path.cubicTo(control4.x.toDouble(), control4.y.toDouble(), size.width,
        size.height * .2, size.width, size.height * .2);
    path.lineTo(size.width, size.height);
    path.lineTo(0, size.height);
    return path;
  }

  @override
  bool shouldReclip(CustomClipper<Path> oldClipper) {
    return true;
  }
}
