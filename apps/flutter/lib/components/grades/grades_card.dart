import 'package:class_companion/components/bottom_sheet_container.dart';
import 'package:class_companion/components/grades/add_oral_grade_form.dart';
import 'package:class_companion/components/grades/add_written_grade_form.dart';
import 'package:class_companion/components/grades/confirm_oral_grade_button.dart';
import 'package:class_companion/components/grades/exam_card.dart';
import 'package:class_companion/components/util/card.dart';
import 'package:class_companion/confirmation_status_view.dart';
import 'package:class_companion/database.dart';
import 'package:class_companion/hooks/use_query.dart';
import 'package:class_companion/hooks/use_store.dart';
import 'package:class_companion/models/course.dart';
import 'package:class_companion/models/grade_result.dart';
import 'package:class_companion/static/colors.dart';
import 'package:class_companion/util/date_util.dart';
import 'package:class_companion/util/list_util.dart';
import 'package:class_companion/util/number_util.dart';
import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter_svg/flutter_svg.dart';

class GradesCard extends HookWidget {
  final Course course;

  const GradesCard({super.key, required this.course});

  @override
  Widget build(BuildContext context) {
    final store = useStore();

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

    final heading = Text("Deine Noten",
        style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: theme.primaryText));

    final icon = SvgPicture.asset(
      "assets/icons/muendl.svg",
      width: 64,
    );

    final oralGradeText = Text(
      currentOralGrade != null ? currentOralGrade.result.formatAsGrade() : "—",
      style:
          const TextStyle(fontSize: 32, height: 1, fontWeight: FontWeight.w600),
    );

    final editOralButton = IconButton(
        icon: const Icon(
          Icons.edit_rounded,
        ),
        onPressed: () {
          showSheet(
              context,
              (ctx) => AddOralGradeForm(
                    course: course,
                    store: store,
                    currentOralGrade: currentOralGrade,
                    mostRecentConfirmedOralGrade: mostRecentConfirmedOralGrade,
                  ));
        });

    const oralText = Text(
      "mündlich",
      style: TextStyle(
          fontSize: 16, height: 1, color: Color.fromRGBO(0, 0, 0, .6)),
    );

    final oralLastUpdatedText = Text(
      "Stand: ${currentOralGrade?.date.format() ?? "—"}",
      style: const TextStyle(
          fontSize: 16, height: 1, color: Color.fromRGBO(0, 0, 0, .6)),
    );

    final writtenIcon = SvgPicture.asset(
      "assets/icons/schriftl.svg",
      width: 64,
    );

    final writtenGradeText = Text(
      averageWrittenGrade.formatAsGrade(),
      style:
          const TextStyle(fontSize: 32, height: 1, fontWeight: FontWeight.w600),
    );

    const writtenText = Text(
      "schriftlich",
      style: TextStyle(
          fontSize: 16, height: 1, color: Color.fromRGBO(0, 0, 0, .6)),
    );

    final addWrittenButton = IconButton(
        icon: const Icon(
          Icons.add_rounded,
        ),
        onPressed: () {
          showSheet(context,
              (ctx) => AddWrittenGradeForm(course: course, store: store));
        });

    const writtenInfoText = Text(
      "Deine Note setzt sich aus diesen Ergebnissen zusammen:",
      style: TextStyle(fontSize: 14, color: Color.fromRGBO(0, 0, 0, .8)),
    );
    return MyCard(
        padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            heading,
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 8.0),
                  child: icon,
                ),
                const SizedBox(width: 16),
                Expanded(
                    child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 10),
                            oralGradeText,
                            const SizedBox(height: 4),
                            oralText,
                            const SizedBox(height: 4),
                            oralLastUpdatedText,
                          ],
                        ),
                        editOralButton,
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (currentOralGrade != null)
                      ConfirmationStatusView(
                          confirmedByParent:
                              currentOralGrade.isConfirmedByParent,
                          confirmedByTeacher:
                              currentOralGrade.isConfirmedByTeacher,
                          isOfAge: store.currentUser.isOfAge,
                          order: ConfirmationStatusOrder.teacherParent),
                    if (currentOralGrade != null &&
                        !currentOralGrade.isConfirmed)
                      Align(
                        alignment: Alignment.centerRight,
                        child: ConfirmOralGradeButton(
                          result: currentOralGrade,
                          course: course,
                        ),
                      )
                  ],
                ))
              ],
            ),
            Divider(color: Colors.black.withOpacity(0.2), height: 48),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 8.0),
                  child: writtenIcon,
                ),
                const SizedBox(width: 16),
                Expanded(
                    child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 10),
                            writtenGradeText,
                            const SizedBox(height: 4),
                            writtenText,
                          ],
                        ),
                        addWrittenButton,
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (writtenGrades.isNotEmpty) writtenInfoText
                  ],
                ))
              ],
            ),
            ListView.builder(
                shrinkWrap: true,
                itemCount: writtenGrades.length,
                physics: const NeverScrollableScrollPhysics(),
                itemBuilder: (context, index) => Padding(
                      padding: const EdgeInsets.only(top: 16.0),
                      child: ExamCard(
                        examResult: writtenGrades[index],
                        course: course,
                      ),
                    ))
          ],
        ));
  }
}
