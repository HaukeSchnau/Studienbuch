import 'dart:math';

import 'package:class_mate/database/database.dart';
import 'package:class_mate/models/course.dart';
import 'package:drift/drift.dart';

enum SemesterType {
  winter,
  summer,
}

typedef SemesterId = int;

SemesterId getCurrentSemesterId() {
  final now = DateTime.now();
  int year = now.year;
  bool isWinter = now.month > 7 || now.month < 2;
  if (now.month < 2) {
    year--;
  }
  return getSemesterId(
      year, isWinter ? SemesterType.winter : SemesterType.summer);
}

SemesterId getSemesterId(int year, SemesterType type) {
  return year << 1 | (type == SemesterType.winter ? 1 : 0);
}

class SemesterRange extends Iterable<Semester> {
  final SemesterId start;
  final SemesterId end;

  SemesterRange(this.start, this.end);

  @override
  int get length => end - start + 1;

  @override
  Iterator<Semester> get iterator => _SemesterRangeIterator(start, end);
}

class _SemesterRangeIterator implements Iterator<Semester> {
  final SemesterId end;
  SemesterId currentId;

  _SemesterRangeIterator(this.currentId, this.end) {
    currentId--;
  }

  @override
  Semester get current => Semester(id: currentId);

  @override
  bool moveNext() {
    if (currentId < end) {
      currentId++;
      return true;
    } else {
      return false;
    }
  }
}

class Semesters extends Table {
  IntColumn get id => integer()();

  @override
  Set<Column> get primaryKey => {id};
}

extension SemesterExt on Semester {
  String get name {
    final year = this.year;
    final isWinter = id & 1 == 1;
    if (isWinter) {
      return "Winter $year/${year + 1}";
    } else {
      return "Sommer $year";
    }
  }

  bool get isWinter => id & 1 == 1;

  int get year => id >> 1;

  DateTime get startDate {
    final year = this.year;
    final month = isWinter ? 8 : 2;
    return DateTime(year, month);
  }

  DateTime get endDate {
    if (isWinter) {
      return DateTime(year + 1, 1, 31);
    } else {
      return DateTime(year, 7, 31);
    }
  }
}

class SemesterCourses extends Table {
  IntColumn get semester => integer().references(Semesters, #id)();

  IntColumn get course => integer().references(Courses, #id)();
}

SemesterRange getRelevantSemesters(Year year) {
  final startYear = year.startYear + 6; // Year 11 = year 5 + 6 years
  final firstRelevantSemesterId = getSemesterId(startYear, SemesterType.winter);

  final relevantSemesters = SemesterRange(
      min(getCurrentSemesterId(), firstRelevantSemesterId),
      getCurrentSemesterId());

  return relevantSemesters;
}
