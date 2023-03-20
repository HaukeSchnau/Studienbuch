import 'package:flutter/material.dart';

class Circle extends StatelessWidget {
  final double size;
  final Color color;

  const Circle({super.key, required this.size, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color.withOpacity(.5),
        ));
  }
}
