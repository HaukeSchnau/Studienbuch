import 'package:class_mate/components/bottom_sheet_container.dart';
import 'package:class_mate/components/tasks/add_task_form.dart';
import 'package:class_mate/components/tasks/tasks_view.dart';
import 'package:class_mate/database.dart';
import 'package:class_mate/hooks/use_query.dart';
import 'package:class_mate/hooks/use_store.dart';
import 'package:class_mate/models/course.dart';
import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:provider/provider.dart';

class TasksOverview extends HookWidget {
  final Course? course;

  const TasksOverview({super.key, this.course});

  @override
  Widget build(BuildContext context) {
    final store = useStore();

    final courseId = course?.id;

    final tasks = useQueryJoin(
        () => (db.select(db.tasks)).join(
              [
                innerJoin(
                  db.courses,
                  db.courses.id.equalsExp(db.tasks.course),
                )
              ],
            )
              ..where(
                courseId != null
                    ? db.tasks.course.equals(courseId)
                    : const Constant(true),
              )
              ..orderBy(
                [
                  OrderingTerm(
                    expression: db.tasks.done,
                    mode: OrderingMode.asc,
                  ),
                  OrderingTerm(
                    expression: db.tasks.dueDate,
                    mode: OrderingMode.asc,
                  )
                ],
              ),
        [courseId]).map((row) {
      final task = row.readTable(db.tasks);
      final course = row.readTable(db.courses);
      return TaskWithCourse(task, course);
    }).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40.0),
          child: Row(
            children: [
              const Expanded(
                child: Text(
                  "Hausaufgaben",
                  style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 28),
                ),
              ),
              Material(
                color: Colors.transparent,
                child: IconButton(
                    icon: const Icon(Icons.add, color: Colors.white),
                    onPressed: () => showSheet(
                        context,
                        (ctx) => Provider.value(
                            value: store,
                            child: AddTaskForm(predefinedCourse: course)))),
              )
            ],
          ),
        ),
        const Padding(
          padding: EdgeInsets.only(bottom: 0.0),
        ),
        TasksView(tasks: tasks),
      ],
    );
  }
}
