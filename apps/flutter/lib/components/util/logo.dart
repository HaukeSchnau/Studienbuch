import 'package:flutter/material.dart';

class Logo extends StatelessWidget {
  final double size;

  const Logo({super.key, this.size = 150});

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      "assets/logo.png",
      width: size,
    );
  }
}
