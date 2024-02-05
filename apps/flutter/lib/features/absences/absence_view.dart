import 'package:class_mate/features/grades/confirmation_status_view.dart';
import 'package:class_mate/database/database.dart';
import 'package:class_mate/business_domain/user/use_user.dart';
import 'package:class_mate/features/absences/absence.dart';
import 'package:class_mate/infrastructure/util/date_util.dart';
import 'package:class_mate/features/grades/confirmation_view.dart';
import 'package:class_mate/presentation/colors.dart';
import 'package:class_mate/presentation/components/card.dart';
import 'package:class_mate/features/grades/confirm_with_signature.dart';
import 'package:class_mate/features/grades/confirmation_info.dart';
import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class AbsenceView extends HookWidget {
  final AbsenceGroup absenceGroup;

  const AbsenceView({super.key, required this.absenceGroup});

  @override
  Widget build(BuildContext context) {
    final user = useUser();

    // Show a confirmation dialog, then delete the absence
    delete() async {
      final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
                title: const Text("Fehlzeit löschen"),
                content: const Text(
                    "Bist du sicher, dass Du diese Fehlzeit löschen möchten?"),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.of(context).pop(false),
                      child: const Text("Abbrechen")),
                  TextButton(
                      onPressed: () => Navigator.of(context).pop(true),
                      child: const Text("Löschen"))
                ],
              ));
      if (confirmed == true) {
        for (final absence in absenceGroup.children) {
          await (db.delete(db.absences)
                ..where((tbl) => tbl.id.equals(absence.id)))
              .go();
        }
      }
    }

    excuseTeacher() {
      assert(absenceGroup.children.length == 1);
      final absence = absenceGroup.children.first;
      confirmWithSignature(
          context, (ctx) => buildAbsenceInfoTeacher(absence, user),
          title: "Fehlzeit entschuldigen (Lehrer)",
          signer: "Unterschrift von ${absence.course.teacher.name}",
          fileName: "absence-excuse-${absence.id}-teacher.svg",
          onSuccess: () => (db.update(db.absences)
                    ..where((tbl) => tbl.id.equals(absence.id)))
                  .write(const AbsencesCompanion(
                isExcusedByTeacher: Value(true),
              )));
    }

    excuseParent() => confirmWithSignature(
            context, (ctx) => buildAbsenceInfoParent(absenceGroup, user),
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

    viewFullConfirmation() =>
        viewAbsenceConfirmation(context, absenceGroup, user);

    return MyCard(
        color: absenceGroup.isExcused
            ? theme.primaryDesaturated
            : theme.errorDesaturated,
        borderRadius: BorderRadius.circular(24),
        shadow: false,
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
        onTap: absenceGroup.isExcused ? viewFullConfirmation : null,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
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
                  const SizedBox(height: 8),
                  ConfirmationStatusView(
                    confirmedByParent: absenceGroup.isExcusedByParent,
                    confirmedByTeacher: absenceGroup.isExcusedByTeacher,
                    isOfAge: user.isOfAge,
                    order: ConfirmationStatusOrder.parentTeacher,
                    confirmedText: "Entschuldigt",
                  )
                ],
              ),
            ),
            if (!absenceGroup.isExcused)
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  OutlinedButton(
                      style: OutlinedButton.styleFrom(
                          side: BorderSide(color: theme.error),
                          padding: const EdgeInsets.symmetric(
                            vertical: 8,
                            horizontal: 16,
                          )),
                      onPressed: absenceGroup.isExcusedByParent
                          ? excuseTeacher
                          : excuseParent,
                      child: Text("Entschuldigen",
                          style: TextStyle(color: theme.error))),
                  TextButton(
                      onPressed: delete,
                      child:
                          Text("Löschen", style: TextStyle(color: theme.error)))
                ],
              )
          ],
        ));
  }
}
