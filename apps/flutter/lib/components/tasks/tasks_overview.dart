import 'package:class_companion/components/bottom_sheet_container.dart';
import 'package:class_companion/components/tasks/add_task_form.dart';
import 'package:class_companion/hooks/use_store.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter_mobx/flutter_mobx.dart';
import 'package:provider/provider.dart';

class TasksOverview extends HookWidget {
  const TasksOverview({super.key});

  @override
  Widget build(BuildContext context) {
    final store = useStore();

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
                            value: store, child: const AddTaskForm()))),
              )
            ],
          ),
        ),
        const Padding(
          padding: EdgeInsets.only(bottom: 0.0),
        ),
        // TODO
        // Observer(builder: (_) {
        //   return Aufgaben(
        //     UserApi.user?.aufgaben,
        //     onLoadAufgaben: () => UserApi.user?.loadAufgaben(),
        //   );
        // }),
      ],
    );
  }
}
