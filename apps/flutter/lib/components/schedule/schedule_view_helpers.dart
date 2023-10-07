import 'package:class_mate/business_domain/schedule/agenda.dart';
import 'package:class_mate/models/course_time.dart';

const spaceLeft = 52;
const lineOverflow = 8;
const timePad = 0;
const entryPad = 4.0;

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

TimeOfDay getNearestLessonTime(TimeOfDay time) {
  final distances = lessonTimes.map((e) => e.distanceTo(time)).toList();
  final min =
      distances.reduce((value, element) => value < element ? value : element);
  final index = distances.indexOf(min);

  return lessonTimes[index];
}
