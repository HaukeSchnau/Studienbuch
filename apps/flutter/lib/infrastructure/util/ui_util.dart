
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

bool useIsLarge() {
  final context = useContext();
  return MediaQuery.of(context).size.width > 768;
}

double useSpacing() {
  final isLarge = useIsLarge();
  return isLarge ? 2 : 1;
}

double useHorizontalPadding() {
  final context = useContext();
  final isLarge = useIsLarge();
  return isLarge ? MediaQuery.of(context).size.width * .08 : 32;
}
