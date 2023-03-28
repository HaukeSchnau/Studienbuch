import 'dart:io';

import 'package:class_companion/components/confirm_with_signature.dart';
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
import 'package:path_provider/path_provider.dart';

class ExamCard extends HookWidget {
  final GradeResult examResult;
  final Course course;

  const ExamCard({super.key, required this.examResult, required this.course});

  @override
  Widget build(BuildContext context) {
    final store = useStore();

    confirmTeacher() async {
      final signatureSvg = await confirmWithSignature(
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
                        text: course.teacher.name,
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    const TextSpan(
                        text: " bestätige, dass der/die Schüler/in "),
                    TextSpan(
                        text: store.currentUser.name,
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    const TextSpan(text: " am "),
                    TextSpan(
                        text: examResult.date.format(),
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    const TextSpan(text: " die Klausur in "),
                    TextSpan(
                        text: course.name,
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    const TextSpan(text: " mit der Note "),
                    TextSpan(
                        text: examResult.result.formatAsGrade(),
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    const TextSpan(text: " geschrieben hat."),
                  ]))
                ],
              ),
          "Klausurergebnis bestätigen (Lehrer)",
          "Unterschrift von ${course.teacher.name}");

      if (signatureSvg == null) return;

      final directory = await getApplicationDocumentsDirectory();
      final file =
          File("${directory.path}/signature-${examResult.id}-teacher.svg");

      await file.writeAsString(signatureSvg);

      await database.update(database.gradeResults).replace(examResult.copyWith(
            isConfirmedByTeacher: true,
          ));
    }

    confirmParent() async {
      final signatureSvg = await confirmWithSignature(
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
                      text: "Ich habe zur Kenntniss genommen, dass mein Kind ",
                    ),
                    TextSpan(
                        text: store.currentUser.name,
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    const TextSpan(text: " die Klausur in "),
                    TextSpan(
                        text: course.name,
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    const TextSpan(text: " am "),
                    TextSpan(
                        text: examResult.date.format(),
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    const TextSpan(text: " mit der Note "),
                    TextSpan(
                        text: examResult.result.formatAsGrade(),
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    const TextSpan(text: " geschrieben hat."),
                  ]))
                ],
              ),
          "Klausurergebis bestätigen (Eltern)",
          "Unterschrift der Eltern");

      if (signatureSvg == null) return;

      final directory = await getApplicationDocumentsDirectory();
      final file =
          File("${directory.path}/signature-${examResult.id}-parent.svg");

      await file.writeAsString(signatureSvg);

      await database.update(database.gradeResults).replace(examResult.copyWith(
            isConfirmedByParent: true,
          ));
    }

    return Container(
        decoration: BoxDecoration(
          color: theme.secondaryDesaturated,
          borderRadius: BorderRadius.circular(24),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Text(
                  examResult.result.toString().replaceAll(".", ","),
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
                      Text("Klausur vom ${examResult.date.format()}"),
                      ConfirmationStatusView(
                        confirmedByParent: examResult.isConfirmedByParent,
                        confirmedByTeacher: examResult.isConfirmedByTeacher,
                        isOfAge: store.currentUser.isOfAge,
                        order: ConfirmationStatusOrder.teacherParent,
                      )
                    ],
                  ),
                )
              ],
            ),
            const SizedBox(height: 8),
            if (!examResult.isConfirmed)
              Align(
                alignment: Alignment.centerRight,
                child: OutlinedButton(
                    onPressed: examResult.isConfirmedByTeacher
                        ? confirmParent
                        : confirmTeacher,
                    style: OutlinedButton.styleFrom(
                        side: BorderSide(color: theme.error)),
                    child: Text("Jetzt bestätigen",
                        style: TextStyle(color: theme.error))),
              )
          ],
        ));
  }
}
