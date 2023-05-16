import 'package:class_mate/components/util/card.dart';
import 'package:class_mate/database.dart';
import 'package:class_mate/models/course.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

class TaskWithCourse {
  final Task task;
  final Course course;

  const TaskWithCourse(this.task, this.course);
}

class TasksView extends HookWidget {
  final List<TaskWithCourse> tasks;

  const TasksView({super.key, required this.tasks});

  @override
  Widget build(BuildContext context) {
    const padding = EdgeInsets.symmetric(
      horizontal: 32,
      vertical: 16.0,
    );
    const bgColor = Color(0xFF203755);
    const textColor = Colors.white;
    const titleColor = Color(0xFF3CC233);

    var crossAxisCount = tasks.length < 4 ? 1 : 2;
    if (tasks.isEmpty) {
      return const Center(
          child: Padding(
        padding: EdgeInsets.all(16.0),
        child: Text("keine Aufgaben gefunden",
            style: TextStyle(color: Colors.white, fontSize: 16)),
      ));
    } else {
      return SizedBox(
        height: 225.0 * crossAxisCount,
        child: GridView.builder(
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: crossAxisCount,
              crossAxisSpacing: 15.0,
              mainAxisSpacing: 32.0,
              childAspectRatio: 1 / 1.1),
          scrollDirection: Axis.horizontal,
          padding: padding,
          itemCount: tasks.length,
          itemBuilder: (context, index) {
            final task = tasks[index].task;
            final course = tasks[index].course;
            return MyCard(
              disabled: task.done ||
                  task.dueDate
                      .add(const Duration(days: 7))
                      .isBefore(DateTime.now()),
              onTap: () => context.push("/tasks/${task.id}"),
              shadow: false,
              padding: const EdgeInsets.all(24.0),
              width: 180,
              color: bgColor,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    course.name,
                    style: TextStyle(
                        color: textColor.withOpacity(.8), fontSize: 14),
                  ),
                  Text(
                    task.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: titleColor,
                        fontWeight: FontWeight.bold,
                        fontSize: 20),
                  ),
                  Text(
                    task.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white, fontSize: 16),
                  ),
                  Expanded(
                    child: Container(),
                  ),
                  RichText(
                    text: TextSpan(
                        style: TextStyle(
                            color: textColor.withOpacity(.8), fontSize: 16),
                        text: "Fällig am: ",
                        children: [
                          TextSpan(
                              text: DateFormat("dd.MM.")
                                  .format(task.dueDate.toLocal()),
                              style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: !task.done &&
                                          task.dueDate.isBefore(DateTime.now())
                                      ? Colors.red
                                      : textColor))
                        ]),
                  )
                ],
              ),
            );
          },
        ),
      );
    }
  }
}
