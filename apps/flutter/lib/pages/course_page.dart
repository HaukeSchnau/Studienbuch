import 'package:class_companion/components/grades/grades_card.dart';
import 'package:class_companion/components/path_bg_page.dart';
import 'package:class_companion/models/course.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter_svg/flutter_svg.dart';

class CoursePage extends HookWidget {
  final Course course;

  const CoursePage({super.key, required this.course});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        body: PathBackgroundPage(
      child: Padding(
        padding: const EdgeInsets.only(
          right: 32.0,
          left: 16,
          top: 16,
          bottom: 16,
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                IconButton(
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                    onPressed: () => Navigator.of(context).pop()),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 4),
                      Text(course.name,
                          style: const TextStyle(
                              fontSize: 32,
                              height: 1.2,
                              fontWeight: FontWeight.bold,
                              color: Colors.white)),
                      const SizedBox(height: 8),
                      Text(
                        course.teacher.longFormalName,
                        style:
                            const TextStyle(fontSize: 18, color: Colors.white),
                      )
                    ],
                  ),
                ),
                Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                            color: Colors.black.withOpacity(0.2),
                            blurRadius: 8,
                            offset: const Offset(0, 4))
                      ],
                    ),
                    padding: const EdgeInsets.all(16),
                    child: SvgPicture.asset(
                      getCourseIcon(course.name),
                      height: 64,
                    ))
              ],
            ),
            const SizedBox(height: 32),
            Padding(
              padding: const EdgeInsets.only(left: 16.0),
              child: GradesCard(course: course),
            )
          ],
        ),
      ),
    ));
  }
}
