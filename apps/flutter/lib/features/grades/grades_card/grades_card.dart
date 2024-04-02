import 'package:class_mate/database/database.dart';
import 'package:class_mate/features/grades/grades_card/master_grade/master_grade_row.dart';
import 'package:class_mate/features/grades/grades_card/oral_grade/oral_grade_row.dart';
import 'package:class_mate/features/grades/grades_card/written_grade/written_grade_row.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/presentation/colors.dart';
import 'package:class_mate/presentation/components/card.dart';
import 'package:flutter/material.dart';

class GradesCard extends StatelessWidget {
  final Course course;
  final Semester semester;
  final bool locked;

  const GradesCard(
      {super.key,
      required this.course,
      required this.semester,
      required this.locked});

  @override
  Widget build(BuildContext context) {
    final heading = Text("Deine Noten",
        style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: theme.primaryText));

    return MyCard(
        padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            heading,
            const SizedBox(height: 8),
            MasterGradeRow(course: course),
            Divider(color: Colors.black.withOpacity(0.2), height: 48),
            OralGradeRow(course: course, locked: locked),
            Divider(color: Colors.black.withOpacity(0.2), height: 48),
            WrittenGradeRow(course: course, semester: semester, locked: locked),
          ],
        ));
  }
}
