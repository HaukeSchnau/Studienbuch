import 'package:class_companion/components/confirm_with_signature.dart';
import 'package:class_companion/components/confirmation_info.dart';
import 'package:class_companion/components/util/card.dart';
import 'package:class_companion/confirmation_status_view.dart';
import 'package:class_companion/database.dart';
import 'package:class_companion/hooks/use_store.dart';
import 'package:class_companion/models/absence.dart';
import 'package:class_companion/pages/confirmation_view.dart';
import 'package:class_companion/static/colors.dart';
import 'package:class_companion/util/date_util.dart';
import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class AbsenceView extends HookWidget {
  final AbsenceGroup absenceGroup;

  const AbsenceView({super.key, required this.absenceGroup});

  @override
  Widget build(BuildContext context) {
    final store = useStore();

    excuseTeacher() {
      assert(absenceGroup.children.length == 1);
      final absence = absenceGroup.children.first;
      confirmWithSignature(
          context, (ctx) => buildAbsenceInfoTeacher(absence, store.currentUser),
          title: "Fehlzeit entschuldigen (Lehrer)",
          signer: "Unterschrift von ${absence.course.teacher.name}",
          fileName: "absence-excuse-${absence.id}-teacher.svg",
          onSuccess: () => (db.update(db.absences)
                    ..where((tbl) => tbl.id.equals(absence.id)))
                  .write(const AbsencesCompanion(
                isExcusedByTeacher: Value(true),
              )));
    }

    excuseParent() => confirmWithSignature(context,
            (ctx) => buildAbsenceInfoParent(absenceGroup, store.currentUser),
            title: "Fehlzeit entschuldigen (Eltern)",
            signer: "Unterschrift der Eltern",
            fileNames: absenceGroup.children
                .map((absence) => "absence-excuse-${absence.id}-parent.svg")
                .toList(), onSuccess: () async {
          for (final absence in absenceGroup.children) {
            await (db.update(db.absences)
                  ..where((tbl) => tbl.id.equals(absence.id)))
                .write(const AbsencesCompanion(
              isExcusedByParent: Value(true),
            ));
          }
        });

    return MyCard(
        color: absenceGroup.isExcused
            ? theme.primaryDesaturated
            : theme.errorDesaturated,
        borderRadius: BorderRadius.circular(24),
        shadow: false,
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
        onTap: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (ctx) => const ConfirmationView())),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "${absenceGroup.date.format()} (${absenceGroup.children.map((absence) => absence.course.name).join(", ")})",
                        style: const TextStyle(
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        absenceGroup.reason,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                if (!absenceGroup.isExcused)
                  OutlinedButton(
                      style: OutlinedButton.styleFrom(
                          side: BorderSide(color: theme.error)),
                      onPressed: absenceGroup.isExcusedByParent
                          ? excuseTeacher
                          : excuseParent,
                      child: Text("Entschuldigen",
                          style: TextStyle(color: theme.error)))
              ],
            ),
            const SizedBox(height: 8),
            ConfirmationStatusView(
              confirmedByParent: absenceGroup.isExcusedByParent,
              confirmedByTeacher: absenceGroup.isExcusedByTeacher,
              isOfAge: store.currentUser.isOfAge,
              order: ConfirmationStatusOrder.parentTeacher,
              confirmedText: "Entschuldigt",
            )
          ],
        ));
  }
}
