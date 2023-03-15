// import 'package:flutter/material.dart';
// import 'package:igs_lilienthal/components/selector.dart';
// import 'package:igs_lilienthal/static/years.dart';
// import 'package:igs_lilienthal/util/string_util.dart';

// class JahrgangSelector extends StatelessWidget {
//   final String? selected;
//   final Function(String?) onSelect;

//   const JahrgangSelector({Key? key, this.selected, required this.onSelect})
//       : super(key: key);

//   @override
//   Widget build(BuildContext context) {
//     return Selector<String>(
//         name: "Jahrgang",
//         selected: selected,
//         onSelect: onSelect,
//         selectedItemBuilder: (value) => Text(
//               capitalize(value),
//               style: const TextStyle(color: Colors.white),
//             ),
//         itemBuilder: (value) => Text(capitalize(value)),
//         values: years);
//   }
// }
