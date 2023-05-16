import 'package:class_companion/components/confirm_with_signature.dart';
import 'package:class_companion/components/confirmation_info.dart';
import 'package:class_companion/components/util/card.dart';
import 'package:class_companion/confirmation_status_view.dart';
import 'package:class_companion/database.dart';
import 'package:class_companion/hooks/use_store.dart';
import 'package:class_companion/models/course.dart';
import 'package:class_companion/models/grade_result.dart';
import 'package:class_companion/static/colors.dart';
import 'package:class_companion/util/date_util.dart';
import 'package:class_companion/util/number_util.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class ExamCard extends HookWidget {
  final GradeResult examResult;
  final Course course;

  const ExamCard({super.key, required this.examResult, required this.course});

  @override
  Widget build(BuildContext context) {
    final store = useStore();

    confirmTeacher() => confirmWithSignature(
        context,
        (ctx) => buildWrittenGradeConfirmationInfoTeacher(course, store.currentUser, examResult),
        title: "Klausurergebnis bestätigen (Lehrer)",
        signer: "Unterschrift von ${course.teacher.name}",
        fileName: "signature-${examResult.id}-teacher.svg",
        onSuccess: () => db.update(db.gradeResults).replace(examResult.copyWith(
              isConfirmedByTeacher: true,
            )));

    confirmParent() => confirmWithSignature(
        context,
        (ctx) => buildWrittenGradeConfirmationInfoParent(course, store.currentUser, examResult),
        title: "Klausurergebnis bestätigen (Eltern)",
        signer: "Unterschrift der Eltern",
        fileName: "signature-${examResult.id}-parent.svg",
        onSuccess: () => db.update(db.gradeResults).replace(examResult.copyWith(
              isConfirmedByParent: true,
            )));

    return ResultCard(
      result: examResult,
      action: !examResult.isConfirmed
          ? examResult.isConfirmedByTeacher
              ? confirmParent
              : confirmTeacher
          : null,
      actionColor: theme.error,
      userIsOfAge: store.currentUser.isOfAge,
    );
  }
}

class ResultCard extends StatelessWidget {
  final GradeResult result;
  final VoidCallback? action;
  final bool userIsOfAge;
  final String type;
  final String actionText;
  final Color actionColor;

  const ResultCard(
      {super.key,
      required this.result,
      this.action,
      this.userIsOfAge = false,
      this.type = "Klausur",
      this.actionText = "Jetzt bestätigen",
      required this.actionColor});

  @override
  Widget build(BuildContext context) {
    return MyCard(
        color: result.isConfirmed
            ? theme.primaryDesaturated
            : theme.errorDesaturated,
        borderRadius: BorderRadius.circular(24),
        shadow: false,
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
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
                )
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
