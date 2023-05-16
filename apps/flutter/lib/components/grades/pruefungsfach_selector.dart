import 'package:class_mate/components/selector.dart';
import 'package:class_mate/models/course.dart';
import 'package:flutter/material.dart';

class PruefungsfachSelector extends StatelessWidget {
  final Course? selected;
  final List<Course> options;
  final Function(Course?) onSelect;
  final String title;

  const PruefungsfachSelector(
      {super.key,
      this.selected,
      required this.onSelect,
      required this.options,
      required this.title});

  @override
  Widget build(BuildContext context) {
    return Selector<Course>(
        name: title,
        isNull: selected == null,
        selected: selected,
        onSelect: onSelect,
        selectedItemBuilder: (course) => Text(
              course.name,
              style: const TextStyle(color: Colors.white),
            ),
        itemBuilder: (course) => Text(course.name),
        values: options);
  }
}
