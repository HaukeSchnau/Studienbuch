import 'package:intl/intl.dart';

extension Date on DateTime {
  DateTime get startOfDay =>
      copyWith(hour: 0, minute: 0, second: 0, millisecond: 0, microsecond: 0);

  DateTime get startOfWeek =>
      startOfDay.subtract(Duration(days: weekday - DateTime.monday)).startOfDay;

  DateTime get orNextWeekday {
    if (weekday == DateTime.saturday) {
      return add(const Duration(days: 2)).startOfDay;
    }
    if (weekday == DateTime.sunday) {
      return add(const Duration(days: 1)).startOfDay;
    }
    return startOfDay;
  }

  DateTime clamp(DateTime min, DateTime max) {
    if (isBefore(min)) {
      return min;
    }

    if (isAfter(max)) {
      return max;
    }

    return this;
  }

  bool get isToday {
    final now = DateTime.now().startOfDay;

    return now == startOfDay;
  }

  String formatRelative() {
    DateTime now = DateTime.now();
    final difference = now.difference(toLocal());

    DateTime justNow = now.subtract(const Duration(minutes: 1));
    DateTime localDateTime = toLocal();

    if (difference.inMinutes < -1) {
      // Future
      if (difference.inDays.abs() >= 1) {
        return "in ${difference.inDays.abs()} Tagen";
      }
      if (difference.inHours.abs() >= 1) {
        return "in ${difference.inHours.abs()} Stunden";
      }
      if (difference.inMinutes.abs() >= 1) {
        return "in ${difference.inMinutes.abs()} Minuten";
      }
    }

    if (!localDateTime.difference(justNow).isNegative) {
      return 'Jetzt';
    }
    String roughTimeString = DateFormat('jm').format(this);
    if (localDateTime.day == now.day &&
        localDateTime.month == now.month &&
        localDateTime.year == now.year) {
      return roughTimeString;
    }
    DateTime yesterday = now.subtract(const Duration(days: 1));
    if (localDateTime.day == yesterday.day &&
        localDateTime.month == yesterday.month &&
        localDateTime.year == yesterday.year) {
      return 'Gestern';
    }
    if (difference.inDays < 4) {
      String weekday = DateFormat('EEEE').format(localDateTime);
      return weekday;
    }
    if (now.year == localDateTime.year) {
      return DateFormat("dd.MM.").format(localDateTime);
    }
    return DateFormat("dd.MM.yyyy").format(this);
  }

  String formatRelativeFuture() {
    DateTime now = DateTime.now();
    DateTime tomorrow = now.add(const Duration(days: 1));
    DateTime localDateTime = toLocal();
    if (localDateTime.day == tomorrow.day &&
        localDateTime.month == tomorrow.month &&
        localDateTime.year == tomorrow.year) {
      return 'Morgen';
    }
    return "in ${localDateTime.difference(DateTime(now.year, now.month, now.day)).inDays} Tagen";
  }

  int get weekNumber {
    int dayOfYear = int.parse(DateFormat("D").format(this));
    return ((dayOfYear - weekday + 10) / 7).floor();
  }

  String formatMonth() {
    var format = DateFormat("MMM yyyy");
    return format.format(toLocal());
  }

  String format({includeTime = false}) {
    var format =
        includeTime ? DateFormat("dd.MM.yyyy HH:mm") : DateFormat("dd.MM.yyyy");
    return format.format(toLocal());
  }

  String formatShort() {
    var format = DateFormat("dd.MM.");
    return format.format(toLocal());
  }

  String formatRelativeDay() {
    DateTime now = DateTime.now();
    DateTime localDateTime = toLocal();
    if (localDateTime.day == now.day &&
        localDateTime.month == now.month &&
        localDateTime.year == now.year) {
      return 'Heute';
    }
    DateTime yesterday = now.subtract(const Duration(days: 1));
    if (localDateTime.day == yesterday.day &&
        localDateTime.month == yesterday.month &&
        localDateTime.year == yesterday.year) {
      return 'Gestern';
    }
    DateTime tomorrow = now.add(const Duration(days: 1));
    if (localDateTime.day == tomorrow.day &&
        localDateTime.month == tomorrow.month &&
        localDateTime.year == tomorrow.year) {
      return 'Morgen';
    }
    return DateFormat("EEEE").format(localDateTime);
  }
}

bool doDatesOverlap(DateTime start1, DateTime end1, DateTime start2, DateTime end2) {
  return start1.isBefore(end2) && end1.isAfter(start2);
}
