import 'package:class_mate/business_domain/user/use_user.dart';
import 'package:class_mate/database/database.dart';
import 'package:class_mate/features/grades/grades_card/oral_grade/add_oral_grade_form.dart';
import 'package:class_mate/features/grades/grades_card/oral_grade/confirm_oral_grade_button.dart';
import 'package:class_mate/features/grades/confirmation_status_view.dart';
import 'package:class_mate/features/grades/confirmation_view.dart';
import 'package:class_mate/features/grades/use_grades.dart';
import 'package:class_mate/infrastructure/util/date_util.dart';
import 'package:class_mate/infrastructure/util/number_util.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/grade_result.dart';
import 'package:class_mate/presentation/components/bottom_sheet_container.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter_svg/flutter_svg.dart';

class OralGradeRow extends HookWidget {
  final Semester semester;
  final Course course;
  final bool locked;

  const OralGradeRow({super.key, required this.course, required this.semester, this.locked = false});

  @override
  Widget build(BuildContext context) {
    final user = useUser();
    final oral = useCurrentOralGrade(course, semester);
    final currentOralGrade = oral.currentOralGrade;
    final mostRecentConfirmedOralGrade = oral.mostRecentConfirmedOralGrade;

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
                    user: user,
                    currentOralGrade: currentOralGrade,
                    mostRecentConfirmedOralGrade: mostRecentConfirmedOralGrade,
                    semester: semester,
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

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 8.0),
          child: Opacity(
              opacity: currentOralGrade == null || currentOralGrade.isConfirmed
                  ? 1
                  : 0.25,
              child: icon),
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
                if (!locked) editOralButton,
              ],
            ),
            const SizedBox(height: 12),
            if (currentOralGrade != null)
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                ConfirmationStatusView(
                    confirmedByParent: currentOralGrade.isConfirmedByParent,
                    confirmedByTeacher: currentOralGrade.isConfirmedByTeacher,
                    isOfAge: user.isOfAge,
                    order: ConfirmationStatusOrder.teacherParent),
                if (currentOralGrade.isConfirmed)
                  IconButton(
                      onPressed: () => viewOralGradeConfirmation(context,
                          course, user, currentOralGrade, oral.pastOralGrades),
                      icon: const Icon(Icons.visibility, color: Colors.black87))
              ]),
            if (currentOralGrade != null && !currentOralGrade.isConfirmed)
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
    );
  }
}
