import 'package:flutter/material.dart';

const double smolCardHeight = 80;

class SmolCard extends StatelessWidget {
  final String mainLine;
  final String secondaryLine;

  const SmolCard(
      {Key? key, required this.mainLine, required this.secondaryLine})
      : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      height: smolCardHeight,
      padding: const EdgeInsets.all(10.0),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(25),
          boxShadow: const [
            BoxShadow(
                color: Color.fromRGBO(0, 0, 0, .16),
                blurRadius: 12,
                offset: Offset(6, 6))
          ]),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            mainLine,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
          Text(
            secondaryLine,
            style: const TextStyle(
                color: Color.fromRGBO(0, 0, 0, .8), fontSize: 13),
          )
        ],
      ),
    );
  }
}
