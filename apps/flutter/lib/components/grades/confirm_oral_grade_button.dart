import 'package:class_companion/components/confirm_with_signature.dart';
import 'package:class_companion/database.dart';
import 'package:class_companion/hooks/use_store.dart';
import 'package:class_companion/models/course.dart';
import 'package:class_companion/static/colors.dart';
import 'package:class_companion/util/date_util.dart';
import 'package:class_companion/util/number_util.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class ConfirmOralGradeButton extends HookWidget {
  final GradeResult result;
  final Course course;

  const ConfirmOralGradeButton(
      {Key? key, required this.result, required this.course})
      : super(key: key);

  @override
  Widget build(BuildContext context) {
    final store = useStore();
    confirmTeacher() => confirmWithSignature(
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
                  const TextSpan(text: " bestätige, dass der/die Schüler/in "),
                  TextSpan(
                      text: store.currentUser.name,
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const TextSpan(text: " am "),
                  TextSpan(
                      text: result.date.format(),
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const TextSpan(text: " die mündliche Note "),
                  TextSpan(
                      text: result.result.formatAsGrade(),
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const TextSpan(text: " in "),
                  TextSpan(
                      text: course.name,
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const TextSpan(text: " hat."),
                ]))
              ],
            ),
        title: "Mündliche Note bestätigen (Lehrer)",
        signer: "Unterschrift von ${course.teacher.name}",
        fileName: "signature-${result.id}-teacher.svg",
        onSuccess: () => db.update(db.gradeResults).replace(result.copyWith(
              isConfirmedByTeacher: true,
            )));

    confirmParent() => confirmWithSignature(
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
                    text: "Ich habe zur Kenntnis genommen, dass mein Kind ",
                  ),
                  TextSpan(
                      text: store.currentUser.name,
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const TextSpan(text: " am "),
                  TextSpan(
                      text: result.date.format(),
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const TextSpan(text: " die mündliche Note "),
                  TextSpan(
                      text: result.result.formatAsGrade(),
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const TextSpan(text: " in "),
                  TextSpan(
                      text: course.name,
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const TextSpan(text: " hat."),
                ]))
              ],
            ),
        title: "Mündliche Note bestätigen (Eltern)",
        signer: "Unterschrift der Eltern",
        fileName: "signature-${result.id}-parent.svg",
        onSuccess: () => db.update(db.gradeResults).replace(result.copyWith(
              isConfirmedByParent: true,
            )));

    return OutlinedButton(
        onPressed: result.isConfirmedByTeacher ? confirmParent : confirmTeacher,
        style: OutlinedButton.styleFrom(side: BorderSide(color: theme.error)),
        child: Text("Jetzt bestätigen", style: TextStyle(color: theme.error)));
  }
}
