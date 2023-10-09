import 'package:class_mate/components/schedule/course_cell.dart';
import 'package:class_mate/components/schedule/schedule_view_helpers.dart';
import 'package:class_mate/components/schedule/schedule_view_math_helpers.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/course_time.dart';
import 'package:flutter/material.dart' hide TimeOfDay;

class ShadowEntry extends StatelessWidget {
  final Course course;
  final int day;
  final TimeOfDay time;
  final double gridWidth;
  final double gridHeight;
  final TimeOfDay maxTime;

  const ShadowEntry({
    super.key,
    required this.course,
    required this.day,
    required this.time,
    required this.gridWidth,
    required this.gridHeight,
    required this.maxTime,
  });

  @override
  Widget build(BuildContext context) {
    final cell =
        CourseCell(name: course.name, teacherName: course.teacher.formalName);

    final decoration = getScheduleEntryDecoration(course);

    final child = Opacity(
      opacity: .7,
      child: Container(
        decoration: decoration,
        child: cell,
      ),
    );

    final x = getXForDay(day, gridWidth);
    final y = getYForTime(time, gridHeight, maxTime);
    final yEnd = getYForTime(time + 80, gridHeight, maxTime);
    final cellHeight = yEnd - y;

    final columnWidth = (gridWidth - spaceLeft) / 5;
    final cellWidth = (columnWidth - entryPad * 2);

    return Positioned(
        left: x, top: y, width: cellWidth, height: cellHeight, child: child);
  }
}
