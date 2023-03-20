// import 'package:class_companion/components/selector.dart';
// import 'package:flutter/material.dart';
// import 'package:igs_lilienthal/components/selector.dart';
// import 'package:igs_lilienthal/models/classes/classes.dart';
// import 'package:igs_lilienthal/util/string_util.dart';

// class ClassSelector extends StatelessWidget {
//   final String name;
//   final List<ClassData> options;
//   final ClassData? selected;
//   final Function(ClassData?) onSelect;

//   const ClassSelector(
//       {super.key,
//       required this.name,
//       required this.options,
//       required this.onSelect,
//       this.selected});

//   @override
//   Widget build(BuildContext context) {
//     return Selector<ClassData>(
//       name: capitalize(name),
//       selectedItemBuilder: (value) => value == nullClass
//           ? const Text(
//               "(nicht belegt)",
//               style: TextStyle(color: Colors.white, fontSize: 14),
//             )
//           : Column(
//               mainAxisAlignment: MainAxisAlignment.center,
//               crossAxisAlignment: CrossAxisAlignment.start,
//               children: [
//                 Text(
//                   value.id,
//                   style: const TextStyle(color: Colors.white),
//                 ),
//                 Text(
//                   value.teacher.name!.split(" ")[0].substring(0, 1) +
//                       ". " +
//                       value.teacher.name!.split(" ").last,
//                   maxLines: 1,
//                   softWrap: false,
//                   style: const TextStyle(color: Colors.white, fontSize: 11),
//                 ),
//               ],
//             ),
//       itemBuilder: (value) => value == nullClass
//           ? const Text("(nicht belegt)")
//           : Column(
//               mainAxisAlignment: MainAxisAlignment.center,
//               crossAxisAlignment: CrossAxisAlignment.start,
//               children: [
//                 Text(
//                   value.id,
//                 ),
//                 Text(
//                   value.teacher.name!.split(" ")[0].substring(0, 1) +
//                       ". " +
//                       value.teacher.name!.split(" ").last,
//                   style: const TextStyle(fontSize: 12),
//                 ),
//               ],
//             ),
//       selected: selected,
//       isNull: selected == nullClass,
//       values: [nullClass] + options,
//       fullWidth: true,
//       onSelect: onSelect,
//     );
//   }
// }
