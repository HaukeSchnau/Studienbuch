import 'package:class_mate/components/confirm_with_signature.dart';
import 'package:class_mate/components/confirmation_info.dart';
import 'package:class_mate/components/util/card.dart';
import 'package:class_mate/confirmation_status_view.dart';
import 'package:class_mate/database/database.dart';
import 'package:class_mate/hooks/use_user.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/grade_result.dart';
import 'package:class_mate/pages/confirmation_view.dart';
import 'package:class_mate/static/colors.dart';
import 'package:class_mate/util/date_util.dart';
import 'package:class_mate/util/number_util.dart';
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
        signer: "Unterschrift von ${course.teacher.name}",
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

class ResultCard extends StatelessWidget {
  final GradeResult result;
  final VoidCallback? action;
  final VoidCallback? deleteAction;
  final bool userIsOfAge;
  final String type;
  final String actionText;
  final Color actionColor;
  final Course course;
  final User user;

  const ResultCard(
      {super.key,
      required this.result,
      this.action,
      this.deleteAction,
      this.userIsOfAge = false,
      this.type = "Klausur",
      this.actionText = "Jetzt bestätigen",
      required this.actionColor,
      required this.course,
      required this.user});

  @override
  Widget build(BuildContext context) {
    viewFullConfirmation() => type == "Klausur"
        ? viewWrittenGradeConfirmation(context, course, user, result)
        : viewOralGradeConfirmation(context, course, user, result);

    return MyCard(
        color: result.isConfirmed
            ? theme.primaryDesaturated
            : theme.errorDesaturated,
        borderRadius: BorderRadius.circular(24),
        shadow: false,
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
        onTap: result.isConfirmed ? viewFullConfirmation : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Text(
                  result.result.formatAsGradeShort().replaceAll(".", ","),
                  style: const TextStyle(
                      fontSize: 24,
                      height: 1,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("$type vom ${result.date.format()}"),
                      ConfirmationStatusView(
                        confirmedByParent: result.isConfirmedByParent,
                        confirmedByTeacher: result.isConfirmedByTeacher,
                        isOfAge: userIsOfAge,
                        order: ConfirmationStatusOrder.teacherParent,
                      )
                    ],
                  ),
                ),
                if (deleteAction != null)
                  IconButton(
                      onPressed: deleteAction,
                      icon: const Icon(Icons.delete_outline_rounded,
                          color: Color.fromRGBO(0, 0, 0, .7)))
              ],
            ),
            const SizedBox(height: 8),
            if (action != null)
              Align(
                alignment: Alignment.centerRight,
                child: OutlinedButton(
                    onPressed: action,
                    style: OutlinedButton.styleFrom(
                        side: BorderSide(color: actionColor)),
                    child:
                        Text(actionText, style: TextStyle(color: actionColor))),
              )
          ],
        ));
  }
}
