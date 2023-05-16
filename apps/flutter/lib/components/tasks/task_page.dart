import 'dart:io';

import 'package:assorted_layout_widgets/assorted_layout_widgets.dart';
import 'package:class_mate/components/util/bottom_panels.dart';
import 'package:class_mate/components/util/image_dialog.dart';
import 'package:class_mate/database.dart';
import 'package:class_mate/hooks/use_query.dart';
import 'package:class_mate/static/colors.dart';
import 'package:class_mate/util/list_util.dart';
import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter_svg/flutter_svg.dart';

class TaskPage extends HookWidget {
  final int taskId;

  const TaskPage({super.key, required this.taskId});

  @override
  Widget build(BuildContext context) {
    final res = useQueryJoin(
        () => (db.select(db.tasks)..where((tbl) => tbl.id.equals(taskId))).join(
              [
                innerJoin(
                  db.courses,
                  db.courses.id.equalsExp(db.tasks.course),
                )
              ],
            )).firstOrNull;
    if (res == null) {
      return const Scaffold();
    }

    final task = res.readTable(db.tasks);
    final course = res.readTable(db.courses);

    final images = task.images
        .split(",")
        .where((e) => e.isNotEmpty)
        .map((e) => File(e))
        .toList();

    final confirmationStatus = task.done
        ? Row(
            children: [
              Text(
                "Erledigt ",
                style: TextStyle(fontSize: 16, color: theme.primaryText),
              ),
              Icon(
                Icons.check,
                color: theme.primaryText,
              )
            ],
          )
        : Row(
            children: [
              Text(
                "Nicht erledigt ",
                style: TextStyle(fontSize: 16, color: theme.error),
              ),
              SvgPicture.asset(
                "assets/icons/cross.svg",
                width: 16,
              )
            ],
          );
    final confirmation = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(padding: EdgeInsets.only(top: 16.0)),
        confirmationStatus,
        const Padding(padding: EdgeInsets.only(top: 4.0)),
        Align(
          alignment: Alignment.centerRight,
          child: ElevatedButton(
            onPressed: () async {
              await (db.update(db.tasks)..where((t) => t.id.equals(task.id)))
                  .write(TasksCompanion(
                done: Value(!task.done),
              ));
            },
            child: Text(
              task.done ? "Bestätigung zurücknehmen" : "Bestätigen",
              style: const TextStyle(color: Colors.white),
            ),
          ),
        )
      ],
    );

    return Scaffold(
      body: SingleChildScrollView(
        child: ColumnSuper(
          innerDistance: -50,
          children: [
            BlueBg(
                child: Container(
              width: MediaQuery.of(context).size.width,
              padding: const EdgeInsets.symmetric(vertical: 24.0 - 16.0),
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 40.0 - 12),
                  child: Row(
                    children: [
                      Material(
                          type: MaterialType.transparency,
                          child: IconButton(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12.0, vertical: 16.0),
                              constraints: const BoxConstraints(minWidth: 32),
                              alignment: Alignment.centerLeft,
                              onPressed: () => Navigator.of(context).pop(),
                              icon: const Icon(
                                // IgsIcons.arrow,
                                Icons.arrow_back_rounded,
                                color: Colors.white,
                                // size: 15,
                              ))),
                      // Icon(IgsIcons.arrow, color: Colors.white, size: 15,),
                      const Text(
                        "Hausaufgaben",
                        style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 24),
                      ),
                    ],
                  ),
                ),
              ),
            )),
            Container(
              width: MediaQuery.of(context).size.width,
              padding: const EdgeInsets.only(
                  top: 32.0, bottom: 16, left: 32, right: 32),
              decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius:
                      BorderRadius.vertical(top: Radius.circular(50))),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              task.title,
                              style: TextStyle(
                                  color: theme.primaryText,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 24),
                            ),
                            Text(
                              course.name,
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold, fontSize: 18),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete,
                            color: Color.fromRGBO(0, 0, 0, .7)),
                        onPressed: () {
                          Widget cancelButton = TextButton(
                            child: const Text("Abbrechen"),
                            onPressed: () {
                              Navigator.pop(context);
                            },
                          );
                          Widget confirmButton = TextButton(
                            child: const Text("Löschen"),
                            onPressed: () async {
                              await (db.delete(db.tasks)
                                    ..where((tbl) => tbl.id.equals(task.id)))
                                  .go();
                              // ignore: use_build_context_synchronously
                              Navigator.pop(context);
                              // ignore: use_build_context_synchronously
                              Navigator.pop(context);
                            },
                          );
                          showDialog(
                            context: context,
                            builder: (context) => AlertDialog(
                              actions: [cancelButton, confirmButton],
                              title: const Text(
                                  "Möchtest du die Aufgabe wirklich löschen?"),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    task.description,
                    style: const TextStyle(
                        color: Color.fromRGBO(0, 0, 0, .7), fontSize: 18),
                  ),
                  const SizedBox(height: 12),
                  if (images.isNotEmpty) ...[
                    const Text(
                      "Bilder",
                      style:
                          TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                    ),
                    GridView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16.0),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 2,
                              mainAxisSpacing: 12,
                              crossAxisSpacing: 32),
                      itemBuilder: (context, index) {
                        var image = images[index];
                        return GestureDetector(
                          onTap: () async {
                            await showDialog(
                              context: context,
                              builder: (context) => ImageDialog(file: image),
                            );
                          },
                          child: Image.file(
                            image,
                            fit: BoxFit.cover,
                          ),
                        );
                      },
                      itemCount: images.length,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                    ),
                    const SizedBox(height: 32)
                  ],
                  confirmation,
                  const SizedBox(height: 64)
                ],
              ),
            )
          ],
        ),
      ),
    );
  }
}
