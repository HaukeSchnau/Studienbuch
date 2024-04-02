import 'package:class_mate/database/database.dart';
import 'package:class_mate/features/grades/grades_card/result_card.dart';
import 'package:class_mate/infrastructure/util/date_util.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/grade_result.dart';
import 'package:class_mate/models/semester.dart';
import 'package:class_mate/presentation/colors.dart';
import 'package:class_mate/presentation/theme.dart';
import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class AddMasterGradeForm extends HookWidget {
  final Course course;
  final Semester semester;
  final GradeResult? currentMasterGrade;
  final GradeResult? mostRecentConfirmedMasterGrade;
  final User user;

  const AddMasterGradeForm(
      {super.key,
      required this.semester,
      required this.course,
      required this.user,
      this.currentMasterGrade,
      this.mostRecentConfirmedMasterGrade});

  @override
  Widget build(BuildContext context) {
    final resultController = useTextEditingController(
        text: currentMasterGrade?.result.toString().replaceAll(".", ",") ?? "");
    useListenable(resultController);

    bool isValid() {
      return validateGradeString(resultController.text);
    }

    final mostRecentConfirmedMasterGrade = this.mostRecentConfirmedMasterGrade;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Align(
          alignment: Alignment.center,
          child: Text("Aktuelle Gesamtnote eintragen",
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: theme.primary)),
        ),
        const SizedBox(height: 32),
        TextField(
          controller: resultController,
          decoration: const InputDecoration(labelText: "Punkte"),
          keyboardType: const TextInputType.numberWithOptions(
            decimal: true,
          ),
          autofocus: true,
        ),
        const SizedBox(height: 16),
        const Text(
          "Diese Note muss im Nachhinein noch von deiner Lehrkraft und deinen Eltern bestätigt werden.",
        ),
        if (mostRecentConfirmedMasterGrade != null &&
            mostRecentConfirmedMasterGrade.id != currentMasterGrade?.id) ...[
          const Divider(
            color: disabledColor,
            height: 32,
          ),
          const Text(
              "Alternativ kannst du die letzte bestätigte Note wiederherstellen:"),
          const SizedBox(height: 16),
          ResultCard(
            result: mostRecentConfirmedMasterGrade,
            type: "Aktuelle Gesamtnote",
            actionColor: theme.primary,
            actionText: "Wiederherstellen",
            course: course,
            user: user,
            action: () async {
              await (db.delete(db.gradeResults)
                    ..where((tbl) =>
                        tbl.date.isBiggerThanValue(
                          mostRecentConfirmedMasterGrade.date,
                        ) &
                        tbl.date.isBetweenValues(
                            semester.startDate, semester.endDate)))
                  .go();

              // ignore: use_build_context_synchronously
              Navigator.of(context).pop();
            },
          )
        ],
        const SizedBox(height: 16),
        Align(
          alignment: Alignment.bottomRight,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              foregroundColor: Colors.white,
              disabledBackgroundColor: disabledColor,
            ),
            onPressed: isValid()
                ? () async {
                    final result = double.parse(
                        resultController.text.replaceAll(",", "."));
                    await db.into(db.gradeResults).insert(
                          GradeResultsCompanion.insert(
                            date: DateTime.now()
                                .clamp(semester.startDate, semester.endDate),
                            result: result,
                            isConfirmedByParent: user.isOfAge
                                ? const Value(true)
                                : const Value.absent(),
                            course: course.id,
                            type: GradeResultType.master,
                          ),
                        );

                    // ignore: use_build_context_synchronously
                    Navigator.of(context).pop();
                  }
                : null,
            child: const Text("Speichern"),
          ),
        ),
      ],
    );
  }
}
