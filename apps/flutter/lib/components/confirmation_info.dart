import 'package:class_companion/database.dart';
import 'package:class_companion/models/absence.dart';
import 'package:class_companion/models/course.dart';
import 'package:class_companion/models/user.dart';
import 'package:class_companion/util/date_util.dart';
import 'package:class_companion/util/number_util.dart';
import 'package:flutter/material.dart';

Widget buildAbsenceInfoTeacher(Absence absence, User user,
    {bool viewOnly = false}) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (!viewOnly)
        Text("Bitte lasse deinen Lehrer hier unterschreiben:",
            style: TextStyle(color: Colors.black.withOpacity(.8))),
      if (!viewOnly) const SizedBox(height: 16),
      Text.rich(TextSpan(style: const TextStyle(fontSize: 16), children: [
        const TextSpan(
          text: "Ich, ",
        ),
        TextSpan(
            text: absence.course.teacher.name,
            style: const TextStyle(fontWeight: FontWeight.bold)),
        const TextSpan(text: " bestätige, dass der/die Schüler/in "),
        TextSpan(
            text: user.name,
            style: const TextStyle(fontWeight: FontWeight.bold)),
        const TextSpan(text: " am "),
        TextSpan(
            text: absence.date.format(),
            style: const TextStyle(fontWeight: FontWeight.bold)),
        const TextSpan(text: " in dem Fach "),
        TextSpan(
            text: absence.course.name,
            style: const TextStyle(fontWeight: FontWeight.bold)),
        const TextSpan(text: " mit folgender Begründung gefehlt hat:"),
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
  );
}

Widget buildAbsenceInfoParent(AbsenceGroup absenceGroup, User user,
    {bool viewOnly = false}) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (!viewOnly)
        Text("Bitte lasse deine Eltern hier unterschreiben:",
            style: TextStyle(color: Colors.black.withOpacity(.8))),
      if (!viewOnly) const SizedBox(height: 16),
      Text.rich(TextSpan(style: const TextStyle(fontSize: 16), children: [
        const TextSpan(
          text: "Ich bestätige, dass mein Kind ",
        ),
        TextSpan(
            text: user.name,
            style: const TextStyle(fontWeight: FontWeight.bold)),
        const TextSpan(text: " am "),
        TextSpan(
            text: absenceGroup.date.format(),
            style: const TextStyle(fontWeight: FontWeight.bold)),
        const TextSpan(text: " mit folgender Begründung gefehlt hat:"),
      ])),
      const SizedBox(height: 8),
      Text(
        absenceGroup.reason,
        style: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
      ),
    ],
  );
}

Widget buildOralGradeConfirmationInfoTeacher(
    Course course, User user, GradeResult result,
    {bool viewOnly = false}) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (!viewOnly)
        Text("Bitte lasse deinen Lehrer hier unterschreiben:",
            style: TextStyle(color: Colors.black.withOpacity(.8))),
      if (!viewOnly) const SizedBox(height: 16),
      Text.rich(TextSpan(style: const TextStyle(fontSize: 16), children: [
        const TextSpan(
          text: "Ich, ",
        ),
        TextSpan(
            text: course.teacher.name,
            style: const TextStyle(fontWeight: FontWeight.bold)),
        const TextSpan(text: " bestätige, dass der/die Schüler/in "),
        TextSpan(
            text: user.name,
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
  );
}

Widget buildOralGradeConfirmationInfoParent(
    Course course, User user, GradeResult result,
    {bool viewOnly = false}) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (!viewOnly)
        Text("Bitte lasse deine Eltern hier unterschreiben:",
            style: TextStyle(color: Colors.black.withOpacity(.8))),
      if (!viewOnly) const SizedBox(height: 16),
      Text.rich(TextSpan(style: const TextStyle(fontSize: 16), children: [
        const TextSpan(
          text: "Ich habe zur Kenntnis genommen, dass mein Kind ",
        ),
        TextSpan(
            text: user.name,
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
  );
}

Widget buildWrittenGradeConfirmationInfoTeacher(
    Course course, User user, GradeResult result,
    {bool viewOnly = false}) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (!viewOnly)
        Text("Bitte lasse deinen Lehrer hier unterschreiben:",
            style: TextStyle(color: Colors.black.withOpacity(.8))),
      if (!viewOnly) const SizedBox(height: 16),
      Text.rich(TextSpan(style: const TextStyle(fontSize: 16), children: [
        const TextSpan(
          text: "Ich, ",
        ),
        TextSpan(
            text: course.teacher.name,
            style: const TextStyle(fontWeight: FontWeight.bold)),
        const TextSpan(text: " bestätige, dass der/die Schüler/in "),
        TextSpan(
            text: user.name,
            style: const TextStyle(fontWeight: FontWeight.bold)),
        const TextSpan(text: " am "),
        TextSpan(
            text: result.date.format(),
            style: const TextStyle(fontWeight: FontWeight.bold)),
        const TextSpan(text: " die Klausur in "),
        TextSpan(
            text: course.name,
            style: const TextStyle(fontWeight: FontWeight.bold)),
        const TextSpan(text: " mit der Note "),
        TextSpan(
            text: result.result.formatAsGrade(),
            style: const TextStyle(fontWeight: FontWeight.bold)),
        const TextSpan(text: " geschrieben hat."),
      ]))
    ],
  );
}

Widget buildWrittenGradeConfirmationInfoParent(
    Course course, User user, GradeResult result,
    {bool viewOnly = false}) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (!viewOnly)
        Text("Bitte lasse deine Eltern hier unterschreiben:",
            style: TextStyle(color: Colors.black.withOpacity(.8))),
      if (!viewOnly) const SizedBox(height: 16),
      Text.rich(TextSpan(style: const TextStyle(fontSize: 16), children: [
        const TextSpan(
          text: "Ich habe zur Kenntnis genommen, dass mein Kind ",
        ),
        TextSpan(
            text: user.name,
            style: const TextStyle(fontWeight: FontWeight.bold)),
        const TextSpan(text: " die Klausur in "),
        TextSpan(
            text: course.name,
            style: const TextStyle(fontWeight: FontWeight.bold)),
        const TextSpan(text: " am "),
        TextSpan(
            text: result.date.format(),
            style: const TextStyle(fontWeight: FontWeight.bold)),
        const TextSpan(text: " mit der Note "),
        TextSpan(
            text: result.result.formatAsGrade(),
            style: const TextStyle(fontWeight: FontWeight.bold)),
        const TextSpan(text: " geschrieben hat."),
      ]))
    ],
  );
}
