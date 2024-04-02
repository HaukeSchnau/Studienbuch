import 'package:class_mate/database/database.dart';
import 'package:class_mate/infrastructure/hooks/use_query.dart';
import 'package:class_mate/infrastructure/util/list_util.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/grade_result.dart';
import 'package:class_mate/models/semester.dart';
import 'package:drift/drift.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class CurrentOralGrade {
  final GradeResult? currentOralGrade;
  final GradeResult? mostRecentConfirmedOralGrade;
  final List<GradeResult> pastOralGrades;

  const CurrentOralGrade(
      {required this.currentOralGrade,
      required this.mostRecentConfirmedOralGrade,
      required this.pastOralGrades});
}

CurrentOralGrade useCurrentOralGrade(Course course, Semester semester) {
  final oralGrades = useQuery(
    () => db.select(db.gradeResults)
      ..where((tbl) =>
          tbl.course.equals(course.id) &
          tbl.type.equalsValue(GradeResultType.oral) &
          tbl.date.isBetweenValues(semester.startDate, semester.endDate))
      ..orderBy([
        (tbl) => OrderingTerm(expression: tbl.date, mode: OrderingMode.desc)
      ]),
    [course.id],
  );
  if (oralGrades == null) {
    return const CurrentOralGrade(
        currentOralGrade: null,
        mostRecentConfirmedOralGrade: null,
        pastOralGrades: []);
  }

  final currentOralGrade = oralGrades.firstOrNull;
  final mostRecentConfirmedOralGrade =
      oralGrades.firstWhereOrNull((element) => element.isConfirmed);

  return CurrentOralGrade(
      currentOralGrade: currentOralGrade,
      mostRecentConfirmedOralGrade: mostRecentConfirmedOralGrade,
      pastOralGrades: oralGrades.skip(1).toList());
}

class CurrentWrittenGrade {
  final List<GradeResult> writtenGrades;
  final double averageWrittenGrade;

  const CurrentWrittenGrade(
      {required this.writtenGrades, required this.averageWrittenGrade});
}

CurrentWrittenGrade useWrittenGrades(Course course, Semester semester) {
  final minDate = semester.startDate;
  final maxDate = semester.endDate;
  final writtenGrades = useQuery(
    () => db.select(db.gradeResults)
      ..where((tbl) =>
          tbl.course.equals(course.id) &
          tbl.type.equalsValue(GradeResultType.written) &
          tbl.date.isBetweenValues(minDate, maxDate))
      ..orderBy([
        (tbl) => OrderingTerm(expression: tbl.date, mode: OrderingMode.desc)
      ]),
    [course.id],
  );

  if (writtenGrades == null) {
    return const CurrentWrittenGrade(
        writtenGrades: [], averageWrittenGrade: double.nan);
  }

  final confirmedGrades = writtenGrades.where((e) => e.isConfirmed);
  final averageWrittenGrade = confirmedGrades.isEmpty
      ? double.nan
      : confirmedGrades.map((e) => e.result).fold<double>(0, (a, b) => a + b) /
          (writtenGrades.length);

  return CurrentWrittenGrade(
      writtenGrades: writtenGrades, averageWrittenGrade: averageWrittenGrade);
}

class CurrentMasterGrade {
  final GradeResult? currentMasterGrade;
  final GradeResult? mostRecentConfirmedMasterGrade;
  final List<GradeResult> pastMasterGrades;

  const CurrentMasterGrade(
      {required this.currentMasterGrade,
      required this.mostRecentConfirmedMasterGrade,
      required this.pastMasterGrades});
}

CurrentMasterGrade useCurrentMasterGrade(Course course, Semester semester) {
  final masterGrades = useQuery(
    () => db.select(db.gradeResults)
      ..where((tbl) =>
          tbl.course.equals(course.id) &
          tbl.type.equalsValue(GradeResultType.master) &
          tbl.date.isBetweenValues(semester.startDate, semester.endDate))
      ..orderBy([
        (tbl) => OrderingTerm(expression: tbl.date, mode: OrderingMode.desc)
      ]),
    [course.id],
  );
  if (masterGrades == null) {
    return const CurrentMasterGrade(
        currentMasterGrade: null,
        mostRecentConfirmedMasterGrade: null,
        pastMasterGrades: []);
  }

  final currentMasterGrade = masterGrades.firstOrNull;
  final mostRecentConfirmedMasterGrade =
      masterGrades.firstWhereOrNull((element) => element.isConfirmed);

  return CurrentMasterGrade(
      currentMasterGrade: currentMasterGrade,
      mostRecentConfirmedMasterGrade: mostRecentConfirmedMasterGrade,
      pastMasterGrades: masterGrades.skip(1).toList());
}

double useAverageMasterGrade(Semester semester) {
  final courses = useCourses();

  final masterGrades = useQuery(
    () => db.select(db.gradeResults)
      ..where((tbl) =>
          tbl.type.equalsValue(GradeResultType.master) &
          tbl.date.isBetweenValues(semester.startDate, semester.endDate) &
          tbl.course.isIn(courses?.map((e) => e.id).toList() ?? []) &
          tbl.isConfirmedByParent.equals(true) &
          tbl.isConfirmedByTeacher.equals(true))
      ..orderBy([
        (tbl) => OrderingTerm(expression: tbl.date, mode: OrderingMode.desc)
      ]),
    [courses, semester],
  );

  return useMemoized(() {
    final seenCourses = <int>{};
    final grades = <double>[];

    for (final grade in masterGrades ?? []) {
      if (seenCourses.contains(grade.course)) {
        continue;
      }

      seenCourses.add(grade.course);
      grades.add(grade.result);
    }

    return grades.fold<double>(0, (a, b) => a + b) / grades.length;
  }, [masterGrades]);
}
