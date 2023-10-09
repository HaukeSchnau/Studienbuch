import 'package:class_mate/components/schedule/course_cell.dart';
import 'package:class_mate/models/course.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class CourseChoicesRow extends HookWidget {
  const CourseChoicesRow({super.key});

  @override
  Widget build(BuildContext context) {
    final courses = useCourses();

    if (courses == null) {
      return const SizedBox();
    }

    return Wrap(
      spacing: 4,
      runSpacing: 4,
      direction: Axis.horizontal,
      children: [
        for (final course in courses)
          DraggableCourseChoiceView(
            course: course,
          )
      ],
    );
  }
}

class DraggableCourseChoiceView extends HookWidget {
  final Course course;

  const DraggableCourseChoiceView({super.key, required this.course});

  @override
  Widget build(BuildContext context) {
    final cell = CourseCell(
      name: course.name,
    );

    final color =
        HSVColor.fromAHSV(1, course.name.hashCode % 360, 1, .65).toColor();

    final decoration = BoxDecoration(
      color: color,
      borderRadius: const BorderRadius.all(Radius.circular(8)),
    );

    final cellWithDecoration = Container(
        decoration: decoration,
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: cell,
        ));

    return Draggable<Course>(
        data: course,
        feedback: Material(
          color: Colors.transparent,
          child: cellWithDecoration,
        ),
        childWhenDragging: cellWithDecoration,
        child: cellWithDecoration);
  }
}
