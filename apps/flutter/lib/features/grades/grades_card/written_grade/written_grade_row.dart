import 'package:class_mate/business_domain/user/use_user.dart';
import 'package:class_mate/database/database.dart';
import 'package:class_mate/features/grades/grades_card/written_grade/add_written_grade_form.dart';
import 'package:class_mate/features/grades/grades_card/written_grade/exam_card.dart';
import 'package:class_mate/features/grades/use_grades.dart';
import 'package:class_mate/infrastructure/util/number_util.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/presentation/components/bottom_sheet_container.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter_svg/flutter_svg.dart';

class WrittenGradeRow extends HookWidget {
  final Course course;
  final Semester semester;
  final bool locked;

  const WrittenGradeRow(
      {super.key,
      required this.course,
      required this.semester,
      this.locked = false});

  @override
  Widget build(BuildContext context) {
    final user = useUser();
    final written = useWrittenGrades(course, semester);
    final writtenGrades = written.writtenGrades;
    final averageWrittenGrade = written.averageWrittenGrade;

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
          showSheet(
              context,
              (ctx) => AddWrittenGradeForm(
                  course: course, user: user, semester: semester));
        });

    const writtenInfoText = Text(
      "Deine Note setzt sich aus diesen Ergebnissen zusammen:",
      style: TextStyle(fontSize: 14, color: Color.fromRGBO(0, 0, 0, .8)),
    );

    return Column(children: [
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
                  if (!locked) addWrittenButton,
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
    ]);
  }
}
