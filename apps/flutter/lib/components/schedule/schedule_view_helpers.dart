import 'package:class_mate/models/course.dart';
import 'package:flutter/material.dart';

BoxDecoration getScheduleEntryDecoration(Course course) {
  final color =
      HSVColor.fromAHSV(1, course.name.hashCode % 360, 1, .65).toColor();

  return BoxDecoration(
    color: color,
    borderRadius: const BorderRadius.all(Radius.circular(8)),
  );
}
