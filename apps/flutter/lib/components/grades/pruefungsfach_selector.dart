// import 'package:flutter/material.dart';
// import 'package:igs_lilienthal/components/selector.dart';
// import 'package:igs_lilienthal/static/subjects.dart';

// class PruefungsfachSelector extends StatelessWidget {
//   final String? selected;
//   final List<String> options;
//   final Function(String?) onSelect;
//   final String title;

//   const PruefungsfachSelector(
//       {Key? key,
//       this.selected,
//       required this.onSelect,
//       required this.options,
//       required this.title})
//       : super(key: key);

//   @override
//   Widget build(BuildContext context) {
//     return Selector<String>(
//         name: title,
//         isNull: selected == null,
//         selected: selected,
//         onSelect: onSelect,
//         selectedItemBuilder: (value) => Text(
//               subjectAbbrvMap[value] ?? "",
//               style: const TextStyle(color: Colors.white),
//             ),
//         itemBuilder: (value) => Text(subjectAbbrvMap[value] ?? ""),
//         values: options);
//   }
// }
