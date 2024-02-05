import 'package:class_mate/features/setup/forms/classes_courses_setup_page.dart';
import 'package:class_mate/models/course.dart' show getCourseIcon;
import 'package:class_mate/presentation/theme.dart';
import 'package:class_mate_api/api.dart';
import 'package:dropdown_button2/dropdown_button2.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

typedef User = QueryCoursesGet200ResponseInnerTeacher;

extension UserExtension on User {
  String get lastName => name.split(" ").last;

  String get formalName {
    if (title != null && title!.isNotEmpty) {
      return "$title $lastName";
    }
    return lastName;
  }
}

class CourseSelector extends StatelessWidget {
  final List<Course> courses;
  final Course? selectedCourse;
  final void Function(Course? newCourse) onCourseSelected;

  const CourseSelector(
      {super.key,
      required this.courses,
      this.selectedCourse,
      required this.onCourseSelected});

  @override
  Widget build(BuildContext context) {
    final canChoose = courses.length > 1;
    courses.sort((a, b) => a.courseId.compareTo(b.courseId));
    final itemsWithNull = [null, ...courses];
    final selectedCourse = this.selectedCourse;

    final iconPath = getCourseIcon(courses[0].name);
    final icon =
        iconPath == null ? Container() : SvgPicture.asset(iconPath, width: 20);
    final courseText = Text(
      courses[0].name,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        fontSize: 14,
        color: selectedCourse == null ? Colors.black : Colors.white,
      ),
    );

    itemBuilder(Course? value) => value == null
        ? const Text("(nicht belegt)")
        : Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value.courseId,
              ),
              Text(
                value.teacher.formalName,
                style: const TextStyle(fontSize: 12),
              ),
            ],
          );

    final dropdown = DropdownButton2<Course?>(
      value: selectedCourse,
      isExpanded: true,
      buttonStyleData: ButtonStyleData(
        height: double.infinity,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
        ),
      ),
      underline: Container(),
      customButton: Align(
        alignment: Alignment.centerLeft,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(children: [
            icon,
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    courseText,
                    Text(
                      selectedCourse != null
                          ? "${selectedCourse.courseId} (${selectedCourse.teacher.formalName})"
                          : "(nicht belegt)",
                      style: TextStyle(
                          color: selectedCourse == null
                              ? Colors.black
                              : Colors.white,
                          fontSize: 10),
                    ),
                  ]),
            ),
          ]),
        ),
      ),
      items: itemsWithNull
          .map((course) => DropdownMenuItem(
                value: course,
                child: itemBuilder(course),
              ))
          .toList(),
      onChanged: (course) => onCourseSelected(course),
    );

    final btn = InkWell(
      borderRadius: BorderRadius.circular(24),
      onTap: () {
        if (selectedCourse == null) {
          onCourseSelected(courses[0]);
        } else {
          onCourseSelected(null);
        }
      },
      child: Align(
        alignment: Alignment.centerLeft,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(children: [
            icon,
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    courseText,
                    Text(
                      selectedCourse != null
                          ? "${selectedCourse.courseId} (${selectedCourse.teacher.formalName})"
                          : "(nicht belegt)",
                      style: TextStyle(
                          color: selectedCourse == null
                              ? Colors.black
                              : Colors.white,
                          fontSize: 10),
                    ),
                  ]),
            ),
          ]),
        ),
      ),
    );

    return Container(
      decoration: BoxDecoration(
        color: selectedCourse == null
            ? disabledColor
            : Theme.of(context).primaryColor,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Material(
        color: Colors.transparent,
        child: canChoose ? dropdown : btn,
      ),
    );
  }
}
