import 'package:class_companion/database.dart';
import 'package:class_companion/hooks/use_query.dart';
import 'package:class_companion/models/course.dart';
import 'package:class_companion/models/grade_result.dart';
import 'package:class_companion/util/list_util.dart';
import 'package:drift/drift.dart';

class CurrentOralGrade {
  final GradeResult? currentOralGrade;
  final GradeResult? mostRecentConfirmedOralGrade;

  const CurrentOralGrade(
      {required this.currentOralGrade,
      required this.mostRecentConfirmedOralGrade});
}

CurrentOralGrade useCurrentOralGrade(Course course) {
  final oralGrades = useQuery(
    () => db.select(db.gradeResults)
      ..where((tbl) =>
          tbl.course.equals(course.id) &
          tbl.type.equalsValue(GradeResultType.oral))
      ..orderBy([
        (tbl) => OrderingTerm(expression: tbl.date, mode: OrderingMode.desc)
      ]),
    [course.id],
  );
  final currentOralGrade = oralGrades.firstOrNull;
  final mostRecentConfirmedOralGrade =
      oralGrades.firstWhereOrNull((element) => element.isConfirmed);

  return CurrentOralGrade(
      currentOralGrade: currentOralGrade,
      mostRecentConfirmedOralGrade: mostRecentConfirmedOralGrade);
}

class CurrentWrittenGrade {
  final List<GradeResult> writtenGrades;
  final double averageWrittenGrade;

  const CurrentWrittenGrade(
      {required this.writtenGrades, required this.averageWrittenGrade});
}

CurrentWrittenGrade useWrittenGrades(Course course) {
  final writtenGrades = useQuery(
    () => db.select(db.gradeResults)
      ..where((tbl) =>
          tbl.course.equals(course.id) &
          tbl.type.equalsValue(GradeResultType.written))
      ..orderBy([
        (tbl) => OrderingTerm(expression: tbl.date, mode: OrderingMode.desc)
      ]),
    [course.id],
  );

  final averageWrittenGrade =
      writtenGrades.map((e) => e.result).fold<double>(0, (a, b) => a + b) /
          (writtenGrades.length);

  return CurrentWrittenGrade(
      writtenGrades: writtenGrades, averageWrittenGrade: averageWrittenGrade);
}
