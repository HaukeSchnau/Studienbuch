import 'package:flutter/material.dart';

class Logo extends StatelessWidget {
  final double size;

  const Logo({Key? key, this.size = 150}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      "assets/logo.png",
      width: size,
    );
  }
}
