import 'package:class_mate/business_domain/schedule/agenda.dart';
import 'package:class_mate/components/schedule/schedule_view_helpers.dart';
import 'package:class_mate/database/database.dart';
import 'package:class_mate/models/agenda_entry.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/course_time.dart';
import 'package:class_mate/models/semester.dart';
import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart' hide TimeOfDay;
import 'package:flutter_hooks/flutter_hooks.dart';

double _getXForDay(int day, double gridWidth) {
  final colWidth = (gridWidth - spaceLeft) / 5;
  return spaceLeft + day * colWidth + entryPad;
}

int _getDayForX(double x, double gridWidth) {
  final colWidth = (gridWidth - spaceLeft) / 5;
  return ((x - spaceLeft) / colWidth).round();
}

class ScheduleEntry extends HookWidget {
  final AgendaEntry entry;
  final bool editMode;
  final double gridHeight;
  final double gridWidth;
  final TimeOfDay maxTime;

  const ScheduleEntry(
      {Key? key,
      required this.entry,
      required this.editMode,
      required this.gridHeight,
      required this.gridWidth,
      required this.maxTime})
      : super(key: key);

  @override
  Widget build(BuildContext context) {
    final columnWidth = (gridWidth - spaceLeft) / 5;
    final cellWidth = columnWidth - entryPad * 2;

    final course = entry.course;
    if (course == null) {
      return const SizedBox();
    }

    final time = entry.recurringTime;
    final day = time.weekday - 1;

    final text = course.name;
    final color = HSVColor.fromAHSV(1, text.hashCode % 360, 1, .65).toColor();

    final x = _getXForDay(day, gridWidth);

    final y = getYForTime(time.start, gridHeight, maxTime);
    final yEnd = getYForTime(time.end, gridHeight, maxTime);
    final cellHeight = yEnd - y;

    final pos = Offset(x + entryPad, y);
    final size = Size(cellWidth, cellHeight);

    final delta = useState(const Offset(0, 0));

    useEffect(() {
      delta.value = const Offset(0, 0);
      return null;
    }, [day, entry.start]);

    final cell = Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          text,
          textAlign: TextAlign.center,
          style: const TextStyle(
              fontWeight: FontWeight.w600, fontSize: 12, color: Colors.white),
        ),
        Text(
          course.teacher.formalName,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 10, color: Colors.white),
        ),
      ],
    );

    final decoration = BoxDecoration(
      color: color,
      borderRadius: const BorderRadius.all(Radius.circular(8)),
    );

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
          opacity: .7,
          child: Container(
            decoration: decoration,
            child: cell,
          ),
        ),
        onDragEnd: (details) async {
          final nearestDay =
              _getDayForX(pos.dx + delta.value.dx, gridWidth) + 1;
          final nearestTimeIndex = getNearestLessonTimeIndex(
              getTimeForY(pos.dy + delta.value.dy, gridHeight, maxTime));

          await (db.update(db.courseTimes)
                ..where((tbl) => tbl.id.equals(time.id)))
              .write(CourseTimesCompanion(
            weekday: Value(nearestDay),
            start: Value(lessonTimes[nearestTimeIndex]),
          ));

          delta.value = const Offset(0, 0);
        },
        onDragUpdate: (details) {
          delta.value += details.delta;
        },
        child: Container(
          decoration: decoration,
          child: cell,
        ));

    final nearestDay = _getDayForX(pos.dx + delta.value.dx, gridWidth);
    final snappedX = _getXForDay(nearestDay, gridWidth);

    final nearestTimeIndex = getNearestLessonTimeIndex(
        getTimeForY(pos.dy + delta.value.dy, gridHeight, maxTime));
    final nearestTime = lessonTimes[nearestTimeIndex];
    final snappedY = getYForTime(nearestTime, gridHeight, maxTime);

    return Positioned(
      top: snappedY,
      left: snappedX,
      width: size.width,
      height: size.height,
      child: editMode ? draggableChild : clickableChild,
    );
  }
}
