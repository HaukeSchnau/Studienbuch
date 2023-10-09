import 'dart:math';

import 'package:class_mate/business_domain/schedule/agenda.dart';
import 'package:class_mate/components/schedule/course_cell.dart';
import 'package:class_mate/components/schedule/schedule_entry.dart';
import 'package:class_mate/components/schedule/schedule_grid_background.dart';
import 'package:class_mate/components/schedule/schedule_view_helpers.dart';
import 'package:class_mate/database/database.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/course_time.dart';
import 'package:class_mate/static/colors.dart';
import 'package:class_mate/util/date_util.dart';
import 'package:drift/drift.dart';
import 'package:flutter/material.dart' hide TimeOfDay;
import 'package:flutter_hooks/flutter_hooks.dart';

class ShadowEntryData {
  final Course course;
  final int day;
  final TimeOfDay time;

  ShadowEntryData(this.course, this.day, this.time);
}

class WeekGrid extends HookWidget {
  final List<Agenda> weeklyAgenda;
  final bool editMode;

  const WeekGrid(
      {super.key, required this.weeklyAgenda, required this.editMode});

  Widget buildCurrentTimeIndicator(
      double height, double width, TimeOfDay maxTime) {
    final now = DateTime.now();
    final time = TimeOfDay.fromDateTime(now);
    const h = 5.0;
    final y = getYForTime(time, height, maxTime) - h / 2;
    final day = now.weekday - 1;
    final x = spaceLeft + day * (width - spaceLeft) / 5;
    final w = (width - spaceLeft) / 5;

    return Positioned(
      top: y,
      left: x,
      child: Container(
        height: h,
        width: w,
        decoration: BoxDecoration(
          color: theme.primary,
          borderRadius: const BorderRadius.all(Radius.circular(8)),
        ),
      ),
    );
  }

  Widget buildCurrentDayIndicator(double height, double width) {
    final now = DateTime.now();
    final day = now.weekday - 1;
    final x = spaceLeft + day * (width - spaceLeft) / 5;
    final w = (width - spaceLeft) / 5;

    return Positioned(
      top: 0,
      left: x,
      child: Container(
        height: height,
        width: w,
        decoration: BoxDecoration(
          color: theme.secondaryDesaturated,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final maxTime = editMode
        ? lessonTimes.last + 80
        : TimeOfDay.fromMinutes(weeklyAgenda
            .map((agenda) => agenda.entries.isNotEmpty
                ? agenda.entries.last.recurringTime.end.toMinutes()
                : 0)
            .reduce((value, element) => max(value, element)));

    final shadowEntry = useState<ShadowEntryData?>(null);

    return LayoutBuilder(builder: (context, constraints) {
      final height = constraints.maxHeight;
      final width = constraints.maxWidth;

      final isToday = weeklyAgenda.any((agenda) => agenda.date.isToday);

      return DragTarget<Course>(onMove: (details) {
        final renderBox = context.findRenderObject() as RenderBox;
        final offset = renderBox.globalToLocal(details.offset);

        final day = getDayForX(offset.dx, width);
        final time = getNearestLessonTime(offset.dy, height, maxTime);

        shadowEntry.value = ShadowEntryData(details.data, day, time);
      }, onLeave: (course) {
        shadowEntry.value = null;
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

        shadowEntry.value = null;
      }, builder: (context, candidateData, rejectedData) {
        return Stack(
          children: [
            if (isToday && !editMode) buildCurrentDayIndicator(height, width),
            WeekGridBackground(maxTime: maxTime),
            for (final lessonTime in lessonTimes)
              Positioned(
                top: getYForTime(lessonTime, height, maxTime) - 8,
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
              for (final block in day.blocks)
                ScheduleEntry(
                  block: block,
                  editMode: editMode,
                  gridHeight: height,
                  gridWidth: width,
                  maxTime: maxTime,
                ),
            if (isToday) buildCurrentTimeIndicator(height, width, maxTime),
            if (shadowEntry.value != null)
              ShadowEntry(
                course: shadowEntry.value!.course,
                day: shadowEntry.value!.day,
                time: shadowEntry.value!.time,
                gridHeight: height,
                gridWidth: width,
                maxTime: maxTime,
              )
          ],
        );
      });
    });
  }
}

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
