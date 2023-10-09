import 'package:class_mate/components/schedule/schedule_view_math_helpers.dart';
import 'package:class_mate/components/util/math.dart';
import 'package:class_mate/database/database.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/course_time.dart';
import 'package:drift/drift.dart';
import 'package:flutter/material.dart' hide TimeOfDay;
import 'package:flutter_hooks/flutter_hooks.dart';

class ShadowEntryData {
  final Course course;
  final int day;
  final TimeOfDay time;

  ShadowEntryData(this.course, this.day, this.time);
}

class NewCourseTimeDragTarget extends HookWidget {
  final Widget Function(BuildContext context) builder;

  final double width;
  final double height;
  final TimeOfDay maxTime;

  final Function(ShadowEntryData? shadowEntry) onShadowEntryChanged;

  const NewCourseTimeDragTarget({
    Key? key,
    required this.builder,
    required this.width,
    required this.height,
    required this.maxTime,
    required this.onShadowEntryChanged,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return DragTarget<Course>(onMove: (details) {
      final renderBox = context.findRenderObject() as RenderBox;
      final offset = renderBox.globalToLocal(details.offset);

      final day = getDayForX(offset.dx, width);
      final time = getNearestLessonTime(offset.dy, height, maxTime);

      onShadowEntryChanged(ShadowEntryData(details.data, day, time));
    }, onLeave: (course) {
      onShadowEntryChanged(null);
    }, onAcceptWithDetails: (details) {
      final renderBox = context.findRenderObject() as RenderBox;
      final offset = renderBox.globalToLocal(details.offset);

      final day = getDayForX(offset.dx, width) + 1;
      final time = getNearestLessonTime(offset.dy, height, maxTime);

      db.into(db.courseTimes).insert(CourseTimesCompanion.insert(
          weekday: clamp(day, 1, 5),
          start: time,
          duration: 80,
          weeks: CourseTimeWeek.both,
          course: Value(
            details.data.id,
          )));

      onShadowEntryChanged(null);
    }, builder: (context, candidateData, rejectedData) {
      return builder(context);
    });
  }
}
