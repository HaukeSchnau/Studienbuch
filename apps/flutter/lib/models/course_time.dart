class TimeOfDay {
  final int hour;
  final int minute;

  const TimeOfDay({required this.hour, required this.minute});

  factory TimeOfDay.now() {
    final now = DateTime.now();
    return TimeOfDay(hour: now.hour, minute: now.minute);
  }

  @override
  String toString() {
    return "$hour:$minute";
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
}

class CourseTime {
  final int weekday;
  final TimeOfDay start;
  final int duration;

  CourseTime({
    required this.weekday,
    required this.start,
    required this.duration,
  });

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

  Map<String, dynamic> toJson() {
    return {
      'weekday': weekday,
      'start': {
        'hour': start.hour,
        'minute': start.minute,
      },
      'duration': duration,
    };
  }

  CourseTime.fromJson(Map<String, dynamic> json)
      : this(
          weekday: json["weekday"],
          start: TimeOfDay(
              hour: json["start"]["hour"], minute: json["start"]["minute"]),
          duration: json["duration"],
        );
}
