import 'package:class_companion/components/confirm_with_signature.dart';
import 'package:class_companion/confirmation_status_view.dart';
import 'package:class_companion/database.dart';
import 'package:class_companion/hooks/use_store.dart';
import 'package:class_companion/models/absence.dart';
import 'package:class_companion/static/colors.dart';
import 'package:class_companion/util/date_util.dart';
import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class AbsenceView extends HookWidget {
  final Absence absence;

  const AbsenceView({super.key, required this.absence});

  @override
  Widget build(BuildContext context) {
    final store = useStore();

    excuseTeacher() => confirmWithSignature(
        context,
        (ctx) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("Bitte lasse deinen Lehrer hier unterschreiben:",
                    style: TextStyle(color: Colors.black.withOpacity(.8))),
                const SizedBox(height: 16),
                Text.rich(
                    TextSpan(style: const TextStyle(fontSize: 16), children: [
                  const TextSpan(
                    text: "Ich, ",
                  ),
                  TextSpan(
                      text: absence.course.teacher.name,
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const TextSpan(text: " bestätige, dass der/die Schüler/in "),
                  TextSpan(
                      text: store.currentUser.name,
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const TextSpan(text: " am "),
                  TextSpan(
                      text: absence.date.format(),
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const TextSpan(text: " in dem Fach "),
                  TextSpan(
                      text: absence.course.name,
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const TextSpan(
                      text: " mit folgender Begründung gefehlt hat:"),
                ])),
                const SizedBox(height: 8),
                Text(
                  absence.reason,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
        title: "Fehlzeit entschuldigen (Lehrer)",
        signer: "Unterschrift von ${absence.course.teacher.name}",
        fileName: "absence-excuse-${absence.id}-teacher.svg",
        onSuccess: () => (db.update(db.absences)
                  ..where((tbl) => tbl.id.equals(absence.id)))
                .write(const AbsencesCompanion(
              isExcusedByTeacher: Value(true),
            )));

    excuseParent() => confirmWithSignature(
        context,
        (ctx) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("Bitte lasse deine Eltern hier unterschreiben:",
                    style: TextStyle(color: Colors.black.withOpacity(.8))),
                const SizedBox(height: 16),
                Text.rich(
                    TextSpan(style: const TextStyle(fontSize: 16), children: [
                  const TextSpan(
                    text: "Ich bestätige, dass mein Kind ",
                  ),
                  TextSpan(
                      text: store.currentUser.name,
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const TextSpan(text: " am "),
                  TextSpan(
                      text: absence.date.format(),
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const TextSpan(text: " in dem Fach "),
                  TextSpan(
                      text: absence.course.name,
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const TextSpan(
                      text: " mit folgender Begründung gefehlt hat:"),
                ])),
                const SizedBox(height: 8),
                Text(
                  absence.reason,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
        title: "Fehlzeit entschuldigen (Eltern)",
        signer: "Unterschrift der Eltern",
        fileName: "absence-excuse-${absence.id}-parent.svg",
        onSuccess: () => (db.update(db.absences)
                  ..where((tbl) => tbl.id.equals(absence.id)))
                .write(const AbsencesCompanion(
              isExcusedByParent: Value(true),
            )));

    return Container(
        decoration: BoxDecoration(
          color: absence.isExcused
              ? theme.primaryDesaturated
              : theme.errorDesaturated,
          borderRadius: BorderRadius.circular(24),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "${absence.date.format()} (${absence.course.name})",
                      style: const TextStyle(
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      absence.reason,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                if (!absence.isExcused)
                  OutlinedButton(
                      style: OutlinedButton.styleFrom(
                          side: BorderSide(color: theme.error)),
                      onPressed: absence.isExcusedByParent
                          ? excuseTeacher
                          : excuseParent,
                      child: Text("Entschuldigen",
                          style: TextStyle(color: theme.error)))
              ],
            ),
            const SizedBox(height: 8),
            ConfirmationStatusView(
              confirmedByParent: absence.isExcusedByParent,
              confirmedByTeacher: absence.isExcusedByTeacher,
              isOfAge: store.currentUser.isOfAge,
              order: ConfirmationStatusOrder.parentTeacher,
              confirmedText: "Entschuldigt",
            )
          ],
        ));
  }
}
