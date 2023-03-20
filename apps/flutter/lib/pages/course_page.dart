import 'package:class_companion/models/course.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class CoursePage extends HookWidget {
  final Course course;

  const CoursePage({super.key, required this.course});

  @override
  Widget build(BuildContext context) {
    return Scaffold(body: Center(child: Text("Course: ${course.name}")));
  }
}
