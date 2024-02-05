import 'package:class_mate/features/schedule/schedule_view_math_helpers.dart';
import 'package:class_mate/infrastructure/util/date_util.dart';
import 'package:flutter/material.dart';

class Weekdays extends StatelessWidget {
  final List<DateTime>? days;

  const Weekdays({super.key, required this.days});

  @override
  Widget build(BuildContext context) {
    final days = this.days;
    const weekdays = [
      "Mo",
      "Di",
      "Mi",
      "Do",
      "Fr",
    ];

    return Row(
      children: [
        const SizedBox(width: spaceLeft + 0),
        for (var i = 0; i < 5; i++)
          Expanded(
            child: Column(
              children: [
                Text(weekdays[i],
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white, fontSize: 16)),
                if (days != null)
                  Text(
                    days[i].formatShort(),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        color: Color.fromRGBO(255, 255, 255, .9), fontSize: 12),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}
