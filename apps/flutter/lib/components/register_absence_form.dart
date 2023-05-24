import 'package:class_mate/components/date_picker.dart';
import 'package:class_mate/database.dart';
import 'package:class_mate/models/store.dart';
import 'package:class_mate/static/colors.dart';
import 'package:class_mate/static/theme.dart';
import 'package:class_mate/util/date_util.dart';
import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:class_mate/models/course.dart';

class RegisterAbsenceForm extends HookWidget {
  final GlobalStore store;

  const RegisterAbsenceForm({super.key, required this.store});

  @override
  Widget build(BuildContext context) {
    final date = useState(DateTime.now().orNextWeekday);
    final reason = useState("");
    final agenda = store.getAgendaForDay(date.value);
    final absenceTimes = useState<Map<Course, bool>>({
      for (var course
          in agenda.entries.map((e) => e.course).whereType<Course>())
        course: true
    });

    useEffect(() {
      final agenda = store.getAgendaForDay(date.value);
      absenceTimes.value = {
        for (var course
            in agenda.entries.map((e) => e.course).whereType<Course>())
          course: true
      };
      return null;
    }, [date.value]);

    bool isValid() {
      return reason.value.isNotEmpty && absenceTimes.value.values.any((e) => e);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Align(
          alignment: Alignment.center,
          child: Text("Fehlzeit eintragen",
              style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: theme.primary)),
        ),
        const SizedBox(height: 32),
        DatePicker(
          label: "Datum",
          date: date.value,
          onDateChanged: (newDate) {
            date.value = newDate;
          },
        ),
        const Divider(height: 32, color: Color.fromRGBO(0, 0, 0, .1)),
        const Padding(
          padding: EdgeInsets.only(left: 16),
          child: Text("Fächer, in denen du gefehlt hast:",
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        ),
        ...agenda.entries.map(
          (entry) {
            final course = entry.course;
            if (course == null) return Container();
            return CheckboxListTile(
              visualDensity: VisualDensity.compact,
              title: Text(course.name),
              value: absenceTimes.value[course],
              onChanged: (value) {
                absenceTimes.value[course] = value!;
                // rerender
                absenceTimes.value = {...absenceTimes.value};
              },
            );
          },
        ).toList(),
        const Divider(height: 32, color: Color.fromRGBO(0, 0, 0, .1)),
        TextField(
          onChanged: (value) => reason.value = value,
          decoration: const InputDecoration(labelText: "Begründung"),
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
                    await db.batch((batch) => batch.insertAll(
                          db.absences,
                          absenceTimes.value.entries
                              .where((e) => e.value)
                              .map(
                                (e) => AbsencesCompanion.insert(
                                  date: date.value,
                                  reason: reason.value,
                                  isExcusedByParent: store.user.isOfAge
                                      ? const Value(true)
                                      : const Value.absent(),
                                  course: e.key.id,
                                ),
                              )
                              .toList(),
                        ));

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
