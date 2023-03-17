import 'package:class_companion/data_hook_widget.dart';
import 'package:class_companion/hooks/use_store.dart';
import 'package:class_companion/models/agenda_entry.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class AgendaEntryView extends DataHookWidget<AgendaEntry> {
  const AgendaEntryView({super.key, super.data});

  @override
  Widget buildWithData(BuildContext context, AgendaEntry entry) {
    final store = useStore();
    final course = entry.course;
    if (course == null) {
      return const Text(
        "Freistunde",
        style: TextStyle(
            fontSize: 20,
            fontStyle: FontStyle.italic,
            color: Color.fromRGBO(0, 0, 0, .3)),
      );
    }

    var start = entry.start;
    var end = entry.end;
    var now = DateTime.now();
    var isOver = entry.isOver;
    var isNow = entry.isNow;
    var circleSize = 10.0;

    final view = Padding(
      padding: const EdgeInsets.symmetric(vertical: 12.0, horizontal: 32),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                isNow
                    ? Row(
                        children: [
                          Container(
                            width: circleSize,
                            height: circleSize,
                            decoration: BoxDecoration(
                                color: store.theme.primary,
                                borderRadius:
                                    BorderRadius.circular(9999999999)),
                          ),
                          const Padding(
                            padding: EdgeInsets.only(left: 8.0),
                          ),
                          Text("Noch ${end.difference(now).inMinutes} Minuten",
                              style: const TextStyle(
                                  fontSize: 12,
                                  color: Color.fromRGBO(0, 0, 0, .7)))
                        ],
                      )
                    : Text(
                        "${DateFormat("HH:mm").format(start)} Uhr",
                        style: const TextStyle(
                            fontSize: 12, color: Color.fromRGBO(0, 0, 0, .7)),
                      ),
                Row(
                  children: [
                    Text(
                      course.name,
                      style: TextStyle(
                          fontSize: 20,
                          color: store.theme.primaryText,
                          // fontWeight: FontWeight.w600,
                          decoration: entry.isCancelled
                              ? TextDecoration.lineThrough
                              : null,
                          decorationColor: store.theme.error,
                          decorationThickness: 2),
                    ),
                    entry.isCancelled
                        ? Padding(
                            padding: const EdgeInsets.only(left: 8.0),
                            child: Text(
                              "(Entfall)",
                              style: TextStyle(
                                  fontSize: 16, color: store.theme.error),
                            ),
                          )
                        : Container()
                  ],
                ),
                Text(
                  course.teacher.name,
                  style: const TextStyle(color: Colors.black87),
                ),
              ],
            ),
          ),
          SizedBox(
            height: 60,
            child: Center(
                child: isOver
                    ? Icon(Icons.check_rounded,
                        color: store.theme.primary, size: 32)
                    : const Icon(Icons.navigate_next_rounded)),
          )
        ],
      ),
    );

    if (isOver) {
      return Opacity(opacity: .5, child: view);
    } else {
      return Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => course.navigateTo(context),
            child: view,
          ));
    }
  }
}
