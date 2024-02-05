import 'package:class_mate/features/agenda/agenda.dart';
import 'package:class_mate/features/schedule/schedule_view_math_helpers.dart';
import 'package:class_mate/models/course_time.dart';
import 'package:flutter/material.dart' hide TimeOfDay;

class WeekGridBackground extends StatelessWidget {
  final TimeOfDay maxTime;

  const WeekGridBackground({super.key, required this.maxTime});

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: CustomPaint(
        painter: WeekGridPainter(maxTime: maxTime),
      ),
    );
  }
}

class WeekGridPainter extends CustomPainter {
  final TimeOfDay maxTime;

  const WeekGridPainter({required this.maxTime});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = const Color(0xffdddddd);

    final width = size.width - spaceLeft;
    final weekdayWidth = width / 5;
    final height = size.height;

    for (int weekday = 0; weekday < 5; weekday++) {
      final x = spaceLeft + weekday * weekdayWidth;
      canvas.drawLine(Offset(x, 0), Offset(x, height), paint..strokeWidth = 1);
    }

    for (int lesson = 0; lesson < 5; lesson++) {
      final lessonTime = lessonTimes[lesson];
      final y = getYForTime(lessonTime, height, maxTime);

      canvas.drawLine(Offset(spaceLeft.toDouble() - lineOverflow, y.toDouble()),
          Offset(size.width, y.toDouble()), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
