import 'package:class_companion/components/agenda/agenda_entry_view.dart';
import 'package:class_companion/components/util/card.dart';
import 'package:class_companion/data_hook_widget.dart';
import 'package:class_companion/models/agenda.dart';
import 'package:flutter/material.dart';

class AgendaView extends DataHookWidget<Agenda> {
  const AgendaView({super.key, super.data});

  @override
  Widget buildWithData(BuildContext context, Agenda agenda) {
    return MyCard(
        clipBehavior: Clip.hardEdge,
        child: ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: agenda.entries.length,
            separatorBuilder: (context, index) => const Divider(
                  height: 0,
                  color: Color.fromRGBO(0, 0, 0, .1),
                ),
            itemBuilder: (context, index) {
              var agendaEntry = agenda.entries[index];
              return AgendaEntryView(
                data: agendaEntry,
              );
            }));
  }
}
