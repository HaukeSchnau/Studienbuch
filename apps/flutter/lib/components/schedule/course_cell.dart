import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class CourseCell extends HookWidget {
  final String name;
  final String? teacherName;

  const CourseCell({
    Key? key,
    required this.name,
    this.teacherName,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final teacherName = this.teacherName;

    final cell = Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          name,
          textAlign: TextAlign.center,
          style: const TextStyle(
              fontWeight: FontWeight.w600, fontSize: 12, color: Colors.white),
        ),
        if (teacherName != null)
          Text(
            teacherName,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 10, color: Colors.white),
          ),
      ],
    );

    return cell;
  }
}
