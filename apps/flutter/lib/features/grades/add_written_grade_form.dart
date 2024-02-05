import 'package:class_mate/database/database.dart';
import 'package:class_mate/infrastructure/util/date_util.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/grade_result.dart';
import 'package:class_mate/presentation/colors.dart';
import 'package:class_mate/presentation/components/date_picker.dart';
import 'package:class_mate/presentation/theme.dart';
import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class AddWrittenGradeForm extends HookWidget {
  final Course course;
  final User user;

  const AddWrittenGradeForm(
      {super.key, required this.course, required this.user});

  @override
  Widget build(BuildContext context) {
    final date = useState(DateTime.now().orNextWeekday);
    final resultStr = useState<String>("");

    bool isValid() {
      return validateGradeString(resultStr.value);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Align(
          alignment: Alignment.center,
          child: Text("Klausurnote eintragen",
              style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: theme.primary)),
        ),
        const SizedBox(height: 32),
        DatePicker(
          label: "Datum der Klausur",
          date: date.value,
          onDateChanged: (newDate) {
            date.value = newDate;
          },
        ),
        const SizedBox(height: 16),
        TextField(
          onChanged: (value) => resultStr.value = (value.replaceAll(",", ".")),
          decoration: const InputDecoration(labelText: "Punkte"),
          keyboardType: const TextInputType.numberWithOptions(
            decimal: true,
          ),
        ),
        const SizedBox(height: 32),
        Align(
          alignment: Alignment.bottomRight,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              foregroundColor: Colors.white,
              disabledBackgroundColor: disabledColor,
            ),
            onPressed: isValid()
                ? () async {
                    await db.into(db.gradeResults).insert(
                        GradeResultsCompanion.insert(
                            date: date.value,
                            result: double.parse(resultStr.value),
                            isConfirmedByParent: user.isOfAge
                                ? const Value(true)
                                : const Value.absent(),
                            course: course.id,
                            type: GradeResultType.written));

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
