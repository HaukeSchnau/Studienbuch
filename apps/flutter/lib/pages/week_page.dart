import 'package:class_companion/hooks/use_store.dart';
import 'package:class_companion/models/agenda.dart';
import 'package:class_companion/models/agenda_entry.dart';
import 'package:class_companion/models/course.dart';
import 'package:class_companion/models/course_time.dart';
import 'package:class_companion/models/semester.dart';
import 'package:class_companion/static/colors.dart';
import 'package:flutter/material.dart' hide TimeOfDay;
import 'package:flutter_hooks/flutter_hooks.dart';

class WeekPage extends HookWidget {
  const WeekPage({super.key});

  @override
  Widget build(BuildContext context) {
    final store = useStore();

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Container(
          decoration: BoxDecoration(
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                spreadRadius: 0,
                blurRadius: 16,
                offset: const Offset(0, 4), // changes position of shadow
              ),
            ],
            color: getDefaultTheme().primary,
          ),
          child: SafeArea(
            child: Column(
              children: const [
                SizedBox(height: 12),
                Align(
                  alignment: Alignment.topCenter,
                  child: Text("Meine Woche",
                      style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 20)),
                ),
                SizedBox(height: 8),
                Weekdays(),
                SizedBox(height: 12),
              ],
            ),
          )),
      Expanded(
          child: WeekGrid(
        weeklyAgenda: store.weeklyAgenda,
      ))
    ]);
  }
}

const spaceLeft = 52;
const lineOverflow = 8;
const timePad = 0;
const entryPad = 4.0;

class Weekdays extends StatelessWidget {
  const Weekdays({super.key});

  @override
  Widget build(BuildContext context) {
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
        for (final weekday in weekdays)
          Expanded(
            child: Text(weekday,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 16)),
          ),
      ],
    );
  }
}

class WeekGrid extends StatelessWidget {
  final List<Agenda> weeklyAgenda;

  const WeekGrid({super.key, required this.weeklyAgenda});

  Widget buildEntry(
      BuildContext context, AgendaEntry entry, double height, double width, ) {
    final course = entry.course;
    if (course == null) {
      return const SizedBox();
    }

    final start = getYForTime(TimeOfDay.fromDateTime(entry.start), height);
    final end = getYForTime(TimeOfDay.fromDateTime(entry.end), height);
    final day = entry.recurringTime.weekday - 1;
    final text = entry.course!.name;
    // final color = HSLColor.fromAHSL(1, text.hashCode % 360, .9, .7).toColor();
    // final color = HSLColor.fromAHSL(1, text.hashCode % 360, 1, .3).toColor();
    final color = HSVColor.fromAHSV(1, text.hashCode % 360, 1, .65).toColor();
    // final color = const Color(0xFF3B7FD9);

    final x = spaceLeft + day * (width - spaceLeft) / 5;
    final w = (width - spaceLeft) / 5;

    return Positioned(
      top: start,
      left: x + entryPad,
      right: width - x - w + entryPad,
      bottom: height - end,
      child: Container(
        decoration: BoxDecoration(
          color: color,
          borderRadius: const BorderRadius.all(Radius.circular(8)),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => course.navigateTo(context, getCurrentSemesterId()),
            borderRadius: const BorderRadius.all(Radius.circular(8)),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Container(
                //   padding: const EdgeInsets.all(4),
                //   decoration: const BoxDecoration(
                //     color: Colors.white,
                //     borderRadius: BorderRadius.all(Radius.circular(4)),
                //   ),
                //   child: SvgPicture.asset(
                //     getCourseIcon(course.name),
                //     height: 16,
                //     width: 16,
                //   ),
                // ),
                // const SizedBox(height: 4),
                Text(
                  text,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                      color: Colors.white),
                ),
                Text(
                  course.teacher.formalName,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 10, color: Colors.white),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final height = constraints.maxHeight;
      final width = constraints.maxWidth;
      return Stack(
        children: [
          const WeekGridBackground(),
          for (final lessonTime in lessonTimes)
            Positioned(
              top: getYForTime(lessonTime, height) - 8,
              left: timePad.toDouble(),
              right: width - spaceLeft + lineOverflow + timePad,
              child: Text(
                "${lessonTime.hour.toString().padLeft(2, '0')}:${lessonTime.minute.toString().padLeft(2, '0')}",
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 12, color: Color.fromRGBO(0, 0, 0, .8)),
              ),
            ),
          for (final day in weeklyAgenda)
            for (final entry in day.entries)
              buildEntry(context, entry, height, width),
        ],
      );
    });
  }
}

class WeekGridBackground extends StatelessWidget {
  const WeekGridBackground({super.key});

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: CustomPaint(
        painter: WeekGridPainter(),
      ),
    );
  }
}

double getYForTime(TimeOfDay time, double height) {
  const startOfDay = TimeOfDay(hour: 7, minute: 30);
  final totalMinutes = Duration(
              hours: lessonTimes.last.hour - startOfDay.hour,
              minutes: lessonTimes.last.minute - startOfDay.minute)
          .inMinutes +
      100;

  final minute = Duration(
          hours: time.hour - startOfDay.hour,
          minutes: time.minute - startOfDay.minute)
      .inMinutes;

  return height * (minute / totalMinutes);
}

class WeekGridPainter extends CustomPainter {
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
      final y = getYForTime(lessonTime, height);

      canvas.drawLine(Offset(spaceLeft.toDouble() - lineOverflow, y.toDouble()),
          Offset(size.width, y.toDouble()), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
