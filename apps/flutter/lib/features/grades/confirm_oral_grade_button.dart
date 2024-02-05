import 'package:class_mate/database/database.dart';
import 'package:class_mate/business_domain/user/use_user.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/presentation/colors.dart';
import 'package:class_mate/features/grades/confirm_with_signature.dart';
import 'package:class_mate/features/grades/confirmation_info.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class ConfirmOralGradeButton extends HookWidget {
  final GradeResult result;
  final Course course;

  const ConfirmOralGradeButton(
      {super.key, required this.result, required this.course});

  @override
  Widget build(BuildContext context) {
    final user = useUser();

    confirmTeacher() => confirmWithSignature(context,
        (ctx) => buildOralGradeConfirmationInfoTeacher(course, user, result),
        title: "Mündliche Note bestätigen (Lehrer)",
        signer: "Unterschrift von ${course.teacher.name}",
        fileName: "signature-${result.id}-teacher.svg",
        onSuccess: () => db.update(db.gradeResults).replace(result.copyWith(
              isConfirmedByTeacher: true,
            )));

    confirmParent() => confirmWithSignature(context,
        (ctx) => buildOralGradeConfirmationInfoParent(course, user, result),
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
