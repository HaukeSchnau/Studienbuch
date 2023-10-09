import 'package:class_mate/business_domain/schedule/agenda.dart';
import 'package:class_mate/components/schedule/course_cell.dart';
import 'package:class_mate/components/schedule/schedule_view_helpers.dart';
import 'package:class_mate/database/database.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/course_time.dart';
import 'package:class_mate/models/semester.dart';
import 'package:class_mate/static/colors.dart';
import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart' hide TimeOfDay;
import 'package:flutter_hooks/flutter_hooks.dart';

double getXForDay(int day, double gridWidth) {
  final colWidth = (gridWidth - spaceLeft) / 5;
  return spaceLeft + day * colWidth + entryPad;
}

int getDayForX(double x, double gridWidth) {
  final colWidth = (gridWidth - spaceLeft) / 5;
  return ((x - spaceLeft) / colWidth).round();
}

class ScheduleEntry extends HookWidget {
  final AgendaTimeBlock block;
  final bool editMode;
  final double gridHeight;
  final double gridWidth;
  final TimeOfDay maxTime;

  const ScheduleEntry(
      {Key? key,
      required this.block,
      required this.editMode,
      required this.gridHeight,
      required this.gridWidth,
      required this.maxTime})
      : super(key: key);

  @override
  Widget build(BuildContext context) {
    final columnWidth = (gridWidth - spaceLeft) / 5;
    final paddedWidth = (columnWidth - entryPad * 2);
    final cellWidth = paddedWidth / block.totalColumns -
        betweenEntriesPad * (block.totalColumns - 1) / 2;

    final entry = block.entry;
    final course = entry.course;
    if (course == null) {
      return const SizedBox();
    }

    final time = entry.recurringTime;
    final day = time.weekday - 1;

    final x = getXForDay(day, gridWidth) + block.column * cellWidth;
    final xWithBetweenPad = x + betweenEntriesPad * block.column;

    final y = getYForTime(time.start, gridHeight, maxTime);
    final yEnd = getYForTime(time.end, gridHeight, maxTime);
    final cellHeight = yEnd - y;

    final pos = Offset(xWithBetweenPad, y);
    final size = Size(cellWidth, cellHeight);

    final delta = useState(const Offset(0, 0));

    useEffect(() {
      delta.value = const Offset(0, 0);
      return null;
    }, [day, entry.start]);

    final cell = CourseCell(
      name: editMode ? course.abbrv : course.name,
      teacherName: !editMode ? course.teacher.formalName : null,
    );

    final decoration = getScheduleEntryDecoration(course);

    final clickableChild = Container(
      decoration: decoration,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
            onTap: () => course.navigateTo(context, getCurrentSemesterId()),
            borderRadius: const BorderRadius.all(Radius.circular(8)),
            child: cell),
      ),
    );

    cycleCourseTimeWeek() async {
      final newWeeks = time.weeks == CourseTimeWeek.both
          ? CourseTimeWeek.odd
          : time.weeks == CourseTimeWeek.odd
              ? CourseTimeWeek.even
              : CourseTimeWeek.both;

      await (db.update(db.courseTimes)..where((tbl) => tbl.id.equals(time.id)))
          .write(CourseTimesCompanion(weeks: Value(newWeeks)));
    }

    final snappedX = _snapX(pos.dx + delta.value.dx, gridWidth);
    final isOffscreen = snappedX == -1 || pos.dy + delta.value.dy < 0;
    final draggableChild = Draggable<CourseTime>(
        data: time,
        feedback: Material(
            type: MaterialType.transparency,
            child: Container(
              width: size.width,
              height: size.height,
              decoration: decoration,
              child: cell,
            )),
        childWhenDragging: Opacity(
          opacity: isOffscreen ? 0 : .7,
          child: Container(
            decoration: decoration,
            child: cell,
          ),
        ),
        onDragEnd: (details) async {
          final nearestDay = getDayForX(pos.dx + delta.value.dx, gridWidth) + 1;
          final nearestTimeIndex = getNearestLessonTimeIndex(
              getTimeForY(pos.dy + delta.value.dy, gridHeight, maxTime));

          if (isOffscreen) {
            await (db.delete(db.courseTimes)
                  ..where((tbl) => tbl.id.equals(time.id)))
                .go();
          } else {
            await (db.update(db.courseTimes)
                  ..where((tbl) => tbl.id.equals(time.id)))
                .write(CourseTimesCompanion(
              weekday: Value(clamp(nearestDay, 1, 5)),
              start: Value(lessonTimes[nearestTimeIndex]),
            ));
          }

          delta.value = const Offset(0, 0);
        },
        onDragUpdate: (details) {
          delta.value += details.delta;
        },
        child: GestureDetector(
          onTap: cycleCourseTimeWeek,
          child: Stack(
            fit: StackFit.expand,
            clipBehavior: Clip.none,
            children: [
              Container(
                decoration: decoration,
                child: cell,
              ),
              if (time.weeks != CourseTimeWeek.both)
                Positioned(
                    bottom: -4,
                    right: -4,
                    child: Container(
                      width: 20,
                      height: 20,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                          color: theme.secondary,
                          borderRadius: BorderRadius.circular(99999)),
                      child: Text(_courseTimeFormatMap[time.weeks] ?? "A/B",
                          style: const TextStyle(
                              fontSize: 12, color: Colors.white)),
                    )),
            ],
          ),
        ));

    if (editMode && delta.value != const Offset(0, 0)) {
      final snappedY = _snapY(pos.dy + delta.value.dy, gridHeight, maxTime);

      return Positioned(
          top: snappedY,
          left: snappedX,
          width: size.width,
          height: size.height,
          child: draggableChild);
    }

    return Positioned(
      top: pos.dy,
      left: pos.dx,
      width: size.width,
      height: size.height,
      child: editMode ? draggableChild : clickableChild,
    );
  }
}

double _snapX(double x, double gridWidth) {
  final nearestDay = clamp(getDayForX(x, gridWidth), -1, 4);
  if (nearestDay == -1) return -1;

  return getXForDay(nearestDay, gridWidth);
}

TimeOfDay getNearestLessonTime(double y, double gridHeight, TimeOfDay maxTime) {
  final nearestTimeIndex =
      getNearestLessonTimeIndex(getTimeForY(y, gridHeight, maxTime));
  return lessonTimes[nearestTimeIndex];
}

double _snapY(double y, double gridHeight, TimeOfDay maxTime) {
  final nearestTime = getNearestLessonTime(y, gridHeight, maxTime);
  return getYForTime(nearestTime, gridHeight, maxTime);
}

int clamp(int value, int min, int max) {
  if (value < min) {
    return min;
  } else if (value > max) {
    return max;
  } else {
    return value;
  }
}

const _courseTimeFormatMap = {
  CourseTimeWeek.both: "A/B",
  CourseTimeWeek.odd: "A",
  CourseTimeWeek.even: "B",
};

BoxDecoration getScheduleEntryDecoration(Course course) {
  final color =
      HSVColor.fromAHSV(1, course.name.hashCode % 360, 1, .65).toColor();

  return BoxDecoration(
    color: color,
    borderRadius: const BorderRadius.all(Radius.circular(8)),
  );
}
