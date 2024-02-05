import 'package:flutter/material.dart';

class CoolDots extends StatelessWidget {
  final int rows, cols;

  const CoolDots({super.key, required this.rows, required this.cols});

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: cols, crossAxisSpacing: 5, mainAxisSpacing: 5),
      itemBuilder: (context, index) => Container(
        decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999999),
            color: const Color.fromRGBO(255, 255, 255, .1)),
      ),
      itemCount: rows * cols,
    );
  }
}
