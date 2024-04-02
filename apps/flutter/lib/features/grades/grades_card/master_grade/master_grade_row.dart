import 'package:class_mate/business_domain/user/use_user.dart';
import 'package:class_mate/features/grades/confirmation_status_view.dart';
import 'package:class_mate/features/grades/confirmation_view.dart';
import 'package:class_mate/features/grades/grades_card/master_grade/add_master_grade_form.dart';
import 'package:class_mate/features/grades/grades_card/master_grade/confirm_master_grade_button.dart';
import 'package:class_mate/features/grades/use_grades.dart';
import 'package:class_mate/infrastructure/util/date_util.dart';
import 'package:class_mate/infrastructure/util/number_util.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/grade_result.dart';
import 'package:class_mate/presentation/colors.dart';
import 'package:class_mate/presentation/components/bottom_sheet_container.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class MasterGradeRow extends HookWidget {
  final Course course;
  final bool locked;

  const MasterGradeRow({super.key, required this.course, this.locked = false});

  @override
  Widget build(BuildContext context) {
    final user = useUser();
    final master = useCurrentMasterGrade(course);
    final currentMasterGrade = master.currentMasterGrade;
    final mostRecentConfirmedMasterGrade =
        master.mostRecentConfirmedMasterGrade;

    const currentMasterText = Text(
      "aktuelle Gesamtnote",
      style: TextStyle(
          fontSize: 16, height: 1, color: Color.fromRGBO(0, 0, 0, .6)),
    );

    final masterGradeText = Text(
      currentMasterGrade != null
          ? currentMasterGrade.result.formatAsGrade()
          : "—",
      style:
          const TextStyle(fontSize: 32, height: 1, fontWeight: FontWeight.w600),
    );

    final editMasterButton = IconButton(
        icon: const Icon(
          Icons.edit_rounded,
        ),
        onPressed: () {
          showSheet(
              context,
              (ctx) => AddMasterGradeForm(
                    course: course,
                    user: user,
                    currentMasterGrade: currentMasterGrade,
                    mostRecentConfirmedMasterGrade:
                        mostRecentConfirmedMasterGrade,
                  ));
        });

    final masterLastUpdatedText = Text(
      "Stand: ${currentMasterGrade?.date.format() ?? "—"}",
      style: const TextStyle(
          fontSize: 16, height: 1, color: Color.fromRGBO(0, 0, 0, .6)),
    );

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 8.0),
          child: Opacity(
              opacity:
                  currentMasterGrade == null || currentMasterGrade.isConfirmed
                      ? 1
                      : 0.25,
              child: Icon(
                Icons.grade_rounded,
                color: theme.primary,
                size: 64,
              )),
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
                    masterGradeText,
                    const SizedBox(height: 4),
                    currentMasterText,
                    const SizedBox(height: 4),
                    masterLastUpdatedText,
                  ],
                ),
                if (!locked) editMasterButton,
              ],
            ),
            const SizedBox(height: 12),
            if (currentMasterGrade != null)
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                ConfirmationStatusView(
                    confirmedByParent: currentMasterGrade.isConfirmedByParent,
                    confirmedByTeacher: currentMasterGrade.isConfirmedByTeacher,
                    isOfAge: user.isOfAge,
                    order: ConfirmationStatusOrder.teacherParent),
                if (currentMasterGrade.isConfirmed)
                  IconButton(
                      onPressed: () => viewMasterGradeConfirmation(
                          context,
                          course,
                          user,
                          currentMasterGrade,
                          master.pastMasterGrades),
                      icon: const Icon(Icons.visibility, color: Colors.black87))
              ]),
            if (currentMasterGrade != null && !currentMasterGrade.isConfirmed)
              Align(
                alignment: Alignment.centerRight,
                child: ConfirmMasterGradeButton(
                  result: currentMasterGrade,
                  course: course,
                ),
              )
          ],
        ))
      ],
    );
  }
}
