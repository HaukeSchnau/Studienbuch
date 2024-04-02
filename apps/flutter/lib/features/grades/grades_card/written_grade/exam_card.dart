import 'package:class_mate/features/grades/confirmation_status_view.dart';
import 'package:class_mate/database/database.dart';
import 'package:class_mate/business_domain/user/use_user.dart';
import 'package:class_mate/features/grades/grades_card/result_card.dart';
import 'package:class_mate/infrastructure/util/date_util.dart';
import 'package:class_mate/infrastructure/util/number_util.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/grade_result.dart';
import 'package:class_mate/features/grades/confirmation_view.dart';
import 'package:class_mate/presentation/colors.dart';
import 'package:class_mate/presentation/components/card.dart';
import 'package:class_mate/features/grades/confirm_with_signature.dart';
import 'package:class_mate/features/grades/confirmation_info.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class ExamCard extends HookWidget {
  final GradeResult examResult;
  final Course course;

  const ExamCard({super.key, required this.examResult, required this.course});

  @override
  Widget build(BuildContext context) {
    final user = useUser();

    delete() async {
      final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
                title: const Text("Klausurergebnis löschen"),
                content: const Text(
                    "Bist du sicher, dass Du dieses Klausurergebnis löschen möchten?"),
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
        await (db.delete(db.gradeResults)
              ..where((tbl) => tbl.id.equals(examResult.id)))
            .go();
      }
    }

    confirmTeacher() => confirmWithSignature(
        context,
        (ctx) =>
            buildWrittenGradeConfirmationInfoTeacher(course, user, examResult),
        title: "Klausurergebnis bestätigen (Lehrer)",
        signer: "Unterschrift von ${course.teacher.longFormalName}",
        fileName: "signature-${examResult.id}-teacher.svg",
        onSuccess: () => db.update(db.gradeResults).replace(examResult.copyWith(
              isConfirmedByTeacher: true,
            )));

    confirmParent() => confirmWithSignature(
        context,
        (ctx) =>
            buildWrittenGradeConfirmationInfoParent(course, user, examResult),
        title: "Klausurergebnis bestätigen (Eltern)",
        signer: "Unterschrift der Eltern",
        fileName: "signature-${examResult.id}-parent.svg",
        onSuccess: () => db.update(db.gradeResults).replace(examResult.copyWith(
              isConfirmedByParent: true,
            )));

    return ResultCard(
        result: examResult,
        course: course,
        action: !examResult.isConfirmed
            ? examResult.isConfirmedByTeacher
                ? confirmParent
                : confirmTeacher
            : null,
        deleteAction: !examResult.isConfirmedByTeacher ? delete : null,
        actionColor: theme.error,
        userIsOfAge: user.isOfAge,
        user: user);
  }
}
