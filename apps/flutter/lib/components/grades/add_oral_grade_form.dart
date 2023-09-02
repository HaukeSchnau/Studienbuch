import 'package:class_mate/components/grades/exam_card.dart';
import 'package:class_mate/database.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/grade_result.dart';
import 'package:class_mate/static/colors.dart';
import 'package:class_mate/static/theme.dart';
import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class AddOralGradeForm extends HookWidget {
  final Course course;
  final GradeResult? currentOralGrade;
  final GradeResult? mostRecentConfirmedOralGrade;
  final User user;

  const AddOralGradeForm(
      {super.key,
      required this.course,
      required this.user,
      this.currentOralGrade,
      this.mostRecentConfirmedOralGrade});

  @override
  Widget build(BuildContext context) {
    final resultController = useTextEditingController(
        text: currentOralGrade?.result.toString().replaceAll(".", ",") ?? "");
    useListenable(resultController);

    bool isValid() {
      return validateGradeString(resultController.text);
    }

    final mostRecentConfirmedOralGrade = this.mostRecentConfirmedOralGrade;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Align(
          alignment: Alignment.center,
          child: Text("Mündliche Mitarbeitsnote eintragen",
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
          "Diese Note muss im Nachhinein noch von deinem Lehrer und deinen Eltern bestätigt werden.",
        ),
        if (mostRecentConfirmedOralGrade != null &&
            mostRecentConfirmedOralGrade.id != currentOralGrade?.id) ...[
          const Divider(
            color: disabledColor,
            height: 32,
          ),
          const Text(
              "Alternativ kannst du die letzte bestätigte Note wiederherstellen:"),
          const SizedBox(height: 16),
          ResultCard(
            result: mostRecentConfirmedOralGrade,
            type: "Mündliche Mitarbeitsnote",
            actionColor: theme.primary,
            actionText: "Wiederherstellen",
            course: course,
            user: user,
            action: () async {
              await (db.delete(db.gradeResults)
                    ..where((tbl) => tbl.date.isBiggerThanValue(
                          mostRecentConfirmedOralGrade.date,
                        )))
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
                            date: DateTime.now(),
                            result: result,
                            isConfirmedByParent: user.isOfAge
                                ? const Value(true)
                                : const Value.absent(),
                            course: course.id,
                            type: GradeResultType.oral,
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
