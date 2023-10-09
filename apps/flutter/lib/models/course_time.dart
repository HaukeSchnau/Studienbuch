import 'package:class_mate/database/database.dart';
import 'package:class_mate/models/course.dart';
import 'package:drift/drift.dart';

class TimeOfDay {
  final int hour;
  final int minute;

  const TimeOfDay({required this.hour, required this.minute});

  TimeOfDay.fromDateTime(DateTime time)
      : hour = time.hour,
        minute = time.minute;

  TimeOfDay.fromMinutes(int minutes)
      : hour = minutes ~/ 60,
        minute = minutes % 60;

  factory TimeOfDay.now() {
    final now = DateTime.now();
    return TimeOfDay(hour: now.hour, minute: now.minute);
  }

  @override
  String toString() {
    return "$hour:$minute";
  }

  int toMinutes() {
    return hour * 60 + minute;
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;

    return other is TimeOfDay && other.hour == hour && other.minute == minute;
  }

  @override
  int get hashCode => hour.hashCode ^ minute.hashCode;

  int compareTo(TimeOfDay other) {
    if (hour == other.hour) {
      return minute.compareTo(other.minute);
    } else {
      return hour.compareTo(other.hour);
    }
  }

  TimeOfDay operator +(int minutes) {
    final newMinute = minute + minutes;
    final newHour = hour + newMinute ~/ 60;
    return TimeOfDay(hour: newHour, minute: newMinute % 60);
  }

  bool isBefore(TimeOfDay other) {
    return compareTo(other) < 0;
  }

  bool isAfter(TimeOfDay other) {
    return compareTo(other) > 0;
  }

  Duration distanceTo(TimeOfDay other) {
    final minutes = toMinutes() - other.toMinutes();
    return Duration(minutes: minutes.abs());
  }
}

enum CourseTimeWeek {
  even,
  odd,
  both,
}

class CourseTimes extends Table {
  IntColumn get id => integer().autoIncrement()();

  IntColumn get weekday => integer()();

  IntColumn get start => integer().map(const TimeOfDayConverter())();

  IntColumn get duration => integer()();

  IntColumn get course => integer().nullable().references(Courses, #id)();

  TextColumn get weeks => textEnum<CourseTimeWeek>()();
}

class TimeOfDayConverter extends TypeConverter<TimeOfDay, int> {
  const TimeOfDayConverter();

  @override
  TimeOfDay fromSql(int fromDb) {
    return TimeOfDay.fromMinutes(fromDb);
  }

  @override
  int toSql(TimeOfDay value) {
    return value.toMinutes();
  }
}

extension CourseTimeExtension on CourseTime {
  TimeOfDay get end => start + duration;

  bool overlap(CourseTime other) {
    if (weekday != other.weekday) {
      return false;
    }

    final start = this.start;
    final end = start + duration;

    final otherStart = other.start;
    final otherEnd = otherStart + other.duration;

    return start.isBefore(otherEnd) && end.isAfter(otherStart) ||
        start == otherStart ||
        end == otherEnd;
  }
}
