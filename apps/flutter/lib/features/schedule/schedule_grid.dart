import 'dart:math';

import 'package:class_mate/features/agenda/agenda.dart';
import 'package:class_mate/features/schedule/schedule_grid_background.dart';
import 'package:class_mate/features/schedule/schedule_view_math_helpers.dart';
import 'package:class_mate/features/schedule/shadow_entry.dart';
import 'package:class_mate/infrastructure/util/date_util.dart';
import 'package:class_mate/models/course_time.dart';
import 'package:class_mate/presentation/colors.dart';
import 'package:class_mate/features/schedule/new_course_time_drag_target.dart';
import 'package:class_mate/features/schedule/schedule_entry.dart';
import 'package:flutter/material.dart' hide TimeOfDay;
import 'package:flutter_hooks/flutter_hooks.dart';

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

      return NewCourseTimeDragTarget(
          width: width,
          height: height,
          maxTime: maxTime,
          onShadowEntryChanged: (shadowEntryData) {
            shadowEntry.value = shadowEntryData;
          },
          builder: (context) {
            final Iterable<AgendaTimeBlock?> allBlocks =
                weeklyAgenda.expand((agenda) => agenda.blocks);
            final firstBlock = allBlocks.firstWhere(
                (block) => block?.entry.course != null,
                orElse: () => null);
            final firstAb = firstBlock != null
                ? allBlocks.firstWhere(
                    (block) =>
                        block?.entry.recurringTime.weeks != CourseTimeWeek.both,
                    orElse: () => firstBlock)
                : null;

            return Stack(
              children: [
                if (isToday && !editMode)
                  buildCurrentDayIndicator(height, width),
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
                      isFirst: block.entry.recurringTime.id ==
                          firstBlock?.entry.recurringTime.id,
                      isFirstAb: block.entry.recurringTime.id ==
                          firstAb?.entry.recurringTime.id,
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
