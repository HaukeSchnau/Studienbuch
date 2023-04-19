import 'package:class_companion/components/confirm_with_signature.dart';
import 'package:class_companion/components/confirmation_info.dart';
import 'package:class_companion/database.dart';
import 'package:class_companion/hooks/use_store.dart';
import 'package:class_companion/models/course.dart';
import 'package:class_companion/static/colors.dart';
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
        (ctx) => buildOralGradeConfirmationInfoTeacher(course, store.currentUser, result),
        title: "Mündliche Note bestätigen (Lehrer)",
        signer: "Unterschrift von ${course.teacher.name}",
        fileName: "signature-${result.id}-teacher.svg",
        onSuccess: () => db.update(db.gradeResults).replace(result.copyWith(
              isConfirmedByTeacher: true,
            )));

    confirmParent() => confirmWithSignature(
        context,
        (ctx) => buildOralGradeConfirmationInfoParent(course, store.currentUser, result),
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
