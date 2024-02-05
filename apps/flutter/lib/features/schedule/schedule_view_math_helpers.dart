import 'package:class_mate/features/agenda/agenda.dart';
import 'package:class_mate/models/course_time.dart';

const spaceLeft = 52;
const lineOverflow = 8;
const timePad = 0;
const entryPad = 4.0;
const betweenEntriesPad = 2.0;

const startOfDay = TimeOfDay(hour: 7, minute: 30);

double getYForTime(TimeOfDay time, double height, TimeOfDay maxTime) {
  final totalMinutesInDay = Duration(
              hours: maxTime.hour - startOfDay.hour,
              minutes: maxTime.minute - startOfDay.minute)
          .inMinutes +
      20;

  final minute = Duration(
          hours: time.hour - startOfDay.hour,
          minutes: time.minute - startOfDay.minute)
      .inMinutes;

  return height * (minute / totalMinutesInDay);
}

TimeOfDay getTimeForY(double y, double height, TimeOfDay maxTime) {
  final totalMinutesInDay = Duration(
              hours: maxTime.hour - startOfDay.hour,
              minutes: maxTime.minute - startOfDay.minute)
          .inMinutes +
      20;

  final percentage = y / height;

  final minutes =
      (percentage * totalMinutesInDay).round() + startOfDay.toMinutes();
  final hour = minutes ~/ 60;

  return TimeOfDay(hour: hour, minute: minutes % 60);
}

int getNearestLessonTimeIndex(TimeOfDay time) {
  final distances = lessonTimes.map((e) => e.distanceTo(time)).toList();
  final min =
      distances.reduce((value, element) => value < element ? value : element);
  return distances.indexOf(min);
}

TimeOfDay getNearestLessonTime(double y, double gridHeight, TimeOfDay maxTime) {
  final nearestTimeIndex =
      getNearestLessonTimeIndex(getTimeForY(y, gridHeight, maxTime));
  return lessonTimes[nearestTimeIndex];
}

double getXForDay(int day, double gridWidth) {
  final colWidth = (gridWidth - spaceLeft) / 5;
  return spaceLeft + day * colWidth + entryPad;
}

int getDayForX(double x, double gridWidth) {
  final colWidth = (gridWidth - spaceLeft) / 5;
  return ((x - spaceLeft) / colWidth).round();
}
