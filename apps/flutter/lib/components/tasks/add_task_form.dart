import 'dart:io';

import 'package:class_companion/components/grades/pruefungsfach_selector.dart';
import 'package:class_companion/database.dart';
import 'package:class_companion/hooks/use_store.dart';
import 'package:class_companion/models/course.dart';
import 'package:class_companion/static/colors.dart';
import 'package:class_companion/static/theme.dart';
import 'package:class_companion/util/date_util.dart';
import 'package:class_companion/util/image_picker_util.dart';
import 'package:class_companion/util/string_util.dart';
import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

class AddTaskForm extends HookWidget {
  const AddTaskForm({super.key});

  @override
  Widget build(BuildContext context) {
    final titleController = useTextEditingController();
    final descController = useTextEditingController();
    final images = useState<List<File>>([]);
    final selectedDate = useState<DateTime?>(null);
    final store = useStore();
    final selectedCourse = useState<Course?>(null);
    useListenable(titleController);
    useListenable(descController);

    // TODO replace with date picker
    Future<DateTime?> openDatePicker() {
      return showDatePicker(
          context: context,
          initialDate: selectedDate.value ?? DateTime.now().startOfDay,
          firstDate: DateTime.now().startOfDay,
          lastDate: DateTime.now().startOfDay.add(const Duration(days: 365)));
    }

    bool isValid() {
      return titleController.text.isNotEmpty &&
          selectedCourse.value != null &&
          selectedDate.value != null;
    }

    return ConstrainedBox(
      constraints: const BoxConstraints(maxHeight: 550),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Aufgabe hinzufügen",
              style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: theme.primaryText,
                  fontSize: 24),
            ),
            const SizedBox(height: 8),
            PruefungsfachSelector(
              title: "Fach",
              options: store.courses,
              onSelect: (newSelected) {
                selectedCourse.value = newSelected;
              },
              selected: selectedCourse.value,
            ),
            const SizedBox(height: 32),
            TextField(
              controller: titleController,
              decoration: const InputDecoration(labelText: "Titel"),
            ),
            const SizedBox(height: 16),
            TextField(
                controller: descController,
                keyboardType: TextInputType.multiline,
                minLines: 4,
                maxLines: null,
                decoration: InputDecoration(
                  labelText: "Beschreibung",
                  alignLabelWithHint: true,
                  floatingLabelBehavior: FloatingLabelBehavior.never,
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(35),
                      borderSide: BorderSide.none),
                )),
            const Padding(padding: EdgeInsets.only(top: 16.0)),
            images.value.isEmpty
                ? Container()
                : GridView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            mainAxisSpacing: 12,
                            crossAxisSpacing: 32),
                    itemBuilder: (context, index) {
                      var image = images.value[index];
                      return Stack(
                        fit: StackFit.expand,
                        children: [
                          Image.file(
                            image,
                            fit: BoxFit.cover,
                          ),
                          Positioned(
                              top: 6,
                              right: 6,
                              child: GestureDetector(
                                  onTap: () {
                                    images.value.removeAt(index);
                                    images.value = [...images.value];
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.all(2),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(99),
                                      color: const Color.fromRGBO(0, 0, 0, .7),
                                    ),
                                    child: const Icon(Icons.close,
                                        color: Colors.white, size: 20),
                                  )))
                        ],
                      );
                    },
                    itemCount: images.value.length,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                  ),
            images.value.isEmpty
                ? Container()
                : const Padding(padding: EdgeInsets.only(top: 8.0)),
            TextButton(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: const [
                  Icon(Icons.add_a_photo_rounded, size: 20),
                  Padding(padding: EdgeInsets.only(left: 4.0)),
                  Text("Foto hinzufügen", style: TextStyle(fontSize: 12))
                ],
              ),
              onPressed: () async {
                final file = await showImagePicker(context);
                if (file != null) {
                  images.value.add(file);
                  images.value = [...images.value];
                }
              },
            ),
            const Divider(color: disabledColor),
            Row(
              children: [
                const Text(
                  "Abgabetermin:  ",
                  style: TextStyle(),
                ),
                OutlinedButton(
                  style: OutlinedButton.styleFrom(
                      side: BorderSide(color: theme.primaryText)),
                  onPressed: () async {
                    final newDate = await openDatePicker();
                    if (newDate != null) {
                      selectedDate.value = newDate;
                    }
                  },
                  child: Text(selectedDate.value?.format() ?? "Datum wählen"),
                )
              ],
            ),
            const Padding(padding: EdgeInsets.only(top: 8.0)),
            Align(
              alignment: Alignment.centerRight,
              child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: disabledColor,
                  ),
                  onPressed: isValid()
                      ? () async {
                          var appDir = await getApplicationDocumentsDirectory();
                          var imagesDir =
                              Directory(p.join(appDir.path, "task_images"));
                          await imagesDir.create(recursive: true);
                          List<String> paths = [];
                          for (var image in images.value) {
                            var path =
                                p.join(imagesDir.path, getRandomString(20));
                            paths.add(path);
                            await image.copy(path);
                          }
                          await db.into(db.tasks).insert(TasksCompanion.insert(
                                title: titleController.text,
                                description: descController.text,
                                dueDate: selectedDate.value!,
                                course: selectedCourse.value!.id,
                                images: Value(paths.join(";")),
                              ));
                          // TODO add notification for new task
                          // createAufgabenNotification(id, titleController.text,
                          //     subjectAbbrvMap[selectedSubject] ?? "", selectedDate);
                          // ignore: use_build_context_synchronously
                          Navigator.pop(context);
                        }
                      : null,
                  child: const Text(
                    "Speichern",
                  )),
            ),
            Padding(
              padding: EdgeInsets.only(
                  top: MediaQuery.of(context).viewInsets.bottom),
            )
          ],
        ),
      ),
    );
  }
}
