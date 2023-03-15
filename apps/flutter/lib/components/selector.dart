// import 'package:class_companion/static/colors.dart';
// import 'package:flutter/material.dart';
// import 'package:igs_lilienthal/models/main_store.dart';

// typedef SelectorItemBuilder<T> = Widget Function(T value);

// class Selector<T> extends StatelessWidget {
//   final String name;
//   final List<T> values;
//   final SelectorItemBuilder<T> itemBuilder;
//   final SelectorItemBuilder<T> selectedItemBuilder;
//   final bool fullWidth;
//   final bool isNull;
//   final T? selected;
//   final Function(T?) onSelect;

//   const Selector(
//       {Key? key,
//       required this.name,
//       required this.values,
//       required this.itemBuilder,
//       required this.selectedItemBuilder,
//       this.fullWidth = false,
//       this.selected,
//       required this.onSelect,
//       this.isNull = false})
//       : super(key: key);

//   @override
//   Widget build(BuildContext context) {
//     return Column(
//       crossAxisAlignment: CrossAxisAlignment.start,
//       children: [
//         Padding(
//           padding: const EdgeInsets.only(left: 12.0, bottom: 4.0),
//           child: Text(
//             "$name:",
//             overflow: TextOverflow.fade,
//             maxLines: 1,
//             softWrap: false,
//             style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
//           ),
//         ),
//         Container(
//           width: fullWidth ? double.infinity : null,
//           decoration: BoxDecoration(
//               color: isNull ? Colors.grey : getDefaultTheme().primary,
//               borderRadius: BorderRadius.circular(16)),
//           child: Material(
//             color: Colors.transparent,
//             child: InkWell(
//               borderRadius: BorderRadius.circular(16),
//               onTap: () {},
//               child: Padding(
//                 padding:
//                     const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
//                 child: DropdownButton<T>(
//                   value: selected,
//                   isExpanded: fullWidth,
//                   icon: const Icon(
//                     Icons.expand_more_rounded,
//                     color: Colors.white,
//                   ),
//                   underline: Container(),
//                   selectedItemBuilder: (context) => values
//                       .map<Widget>((val) => Align(
//                           alignment: Alignment.centerLeft,
//                           child: selectedItemBuilder(val)))
//                       .toList(),
//                   items: values
//                       .map((val) =>
//                           DropdownMenuItem(value: val, child: itemBuilder(val)))
//                       .toList(),
//                   onChanged: onSelect,
//                 ),
//               ),
//             ),
//           ),
//         ),
//       ],
//     );
//   }
// }
