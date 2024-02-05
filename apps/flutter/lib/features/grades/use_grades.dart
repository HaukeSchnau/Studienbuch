import 'package:class_mate/database/database.dart';
import 'package:class_mate/infrastructure/hooks/use_query.dart';
import 'package:class_mate/infrastructure/util/list_util.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/grade_result.dart';
import 'package:drift/drift.dart';

class CurrentOralGrade {
  final GradeResult? currentOralGrade;
  final GradeResult? mostRecentConfirmedOralGrade;
  final List<GradeResult> pastOralGrades;

  const CurrentOralGrade(
      {required this.currentOralGrade,
      required this.mostRecentConfirmedOralGrade,
      required this.pastOralGrades});
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
  if (oralGrades == null) {
    return const CurrentOralGrade(
        currentOralGrade: null, mostRecentConfirmedOralGrade: null,
        pastOralGrades: []);
  }

  final currentOralGrade = oralGrades.firstOrNull;
  final mostRecentConfirmedOralGrade =
      oralGrades.firstWhereOrNull((element) => element.isConfirmed);

  return CurrentOralGrade(
      currentOralGrade: currentOralGrade,
      mostRecentConfirmedOralGrade: mostRecentConfirmedOralGrade,
      pastOralGrades: oralGrades.skip(1).toList()
  );
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

  if (writtenGrades == null) {
    return const CurrentWrittenGrade(
        writtenGrades: [], averageWrittenGrade: double.nan);
  }

  final averageWrittenGrade =
      writtenGrades.map((e) => e.result).fold<double>(0, (a, b) => a + b) /
          (writtenGrades.length);

  return CurrentWrittenGrade(
      writtenGrades: writtenGrades, averageWrittenGrade: averageWrittenGrade);
}
