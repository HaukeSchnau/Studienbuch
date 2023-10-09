class WeekDef {
  final int year;
  final int weekNumber;

  WeekDef(this.year, this.weekNumber);
}

List<DateTime> getDaysInWeek(WeekDef weekDef) {
  var firstOfYear = DateTime(weekDef.year, 1, 1);
  if (firstOfYear.weekday < 5) {
    firstOfYear = firstOfYear.subtract(Duration(days: firstOfYear.weekday - 1));
  } else {
    firstOfYear = firstOfYear.add(Duration(days: 8 - firstOfYear.weekday));
  }
  final firstDayOfWeek =
      firstOfYear.add(Duration(days: (weekDef.weekNumber - 1) * 7));
  return List.generate(5, (index) => firstDayOfWeek.add(Duration(days: index)));
}
