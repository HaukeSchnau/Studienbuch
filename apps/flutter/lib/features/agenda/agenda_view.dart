import 'package:class_mate/features/agenda/agenda.dart';
import 'package:class_mate/infrastructure/data_hook_widget.dart';
import 'package:class_mate/features/agenda/agenda_entry_view.dart';
import 'package:class_mate/presentation/components/card.dart';
import 'package:flutter/material.dart';

class AgendaView extends DataHookWidget<Agenda> {
  const AgendaView({super.key, super.data});

  @override
  Widget buildWithData(BuildContext context, Agenda agenda) {
    return MyCard(
        clipBehavior: Clip.hardEdge,
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: agenda.entries.length,
            separatorBuilder: (context, index) => const Divider(
                  height: 0,
                  color: Color.fromRGBO(0, 0, 0, .1),
                ),
            itemBuilder: (context, index) {
              var entry = agenda.entries[index];
              return AgendaEntryView(data: entry);
            }));
  }
}
