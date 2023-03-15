import 'package:class_companion/pages/classes_courses_setup_page.dart';
import 'package:class_companion/static/theme.dart';
import 'package:class_companion_api/api.dart';
import 'package:dropdown_button2/dropdown_button2.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

const courseIconMap = {
  "Deutsch": "german.svg",
  "Englisch": "english.svg",
  "Mathe": "math.svg",
  "Physik": "physics.svg",
  "Chemie": "chemistry.svg",
  "Biologie": "bio.svg",
  "Informatik": "informatik-2.svg",
  "Geschichte": "history.svg",
  "Politik-Wirtschaft": "pw.svg",
  "Musik": "music.svg",
  "Sport": "sport.svg",
  "Kunst": "art.svg",
  "Religion": "religion.svg",
  "Französisch": "french.svg",
  "Spanisch": "spanish.svg",
  "Latein": "latin.svg",
  "Werte und Normen": "wun.svg",
};

typedef User = QueryCoursesGet200ResponseInnerTeacher;

extension UserExtension on User {
  String get lastName => name.split(" ").last;

  String get formalName {
    if (title != null && title!.isNotEmpty) {
      return "$title $lastName";
    }
    return "${name[0]}. $lastName";
  }
}

String getCourseIcon(String courseName) {
  final icon = courseIconMap[courseName];
  if (icon == null) {
    throw Exception("No icon for course $courseName");
  }
  return "assets/icons/$icon";
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
    final itemsWithNull = [null, ...courses];
    final selectedCourse = this.selectedCourse;

    final icon = SvgPicture.asset(getCourseIcon(courses[0].name), width: 20);
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
                value.courseId ?? value.name,
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
