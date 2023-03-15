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
