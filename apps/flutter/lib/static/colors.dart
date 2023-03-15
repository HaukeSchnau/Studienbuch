import 'package:flutter/material.dart';

class MyTheme {
  final Color primary;
  final Color primaryText;
  final Color primaryDesaturated;
  final Color secondary;
  final Color secondaryDesaturated;
  final Color error;
  final Color lightBg;

  const MyTheme({
    required this.primary,
    required this.primaryText,
    required this.primaryDesaturated,
    required this.secondary,
    required this.secondaryDesaturated,
    required this.error,
    required this.lightBg,
  });

  Map<String, dynamic> toJson() {
    return {
      'primary': primary.value,
      'primaryText': primaryText.value,
      'primaryDesaturated': primaryDesaturated.value,
      'secondary': secondary.value,
      'secondaryDesaturated': secondaryDesaturated.value,
      'error': error.value,
      'lightBg': lightBg.value,
    };
  }
}

const _themes = {
  "igslilienthal.de": MyTheme(
    primary: Color(0xFF33A42B),
    primaryText: Color(0xFF098A00),
    primaryDesaturated: Color(0xFF75B470),
    secondary: Color(0xFF3B7FD9),
    secondaryDesaturated: Color(0xFFEBF0F7),
    error: Color(0xFFA42B33),
    lightBg: Color(0xFFF9F9F9),
  ),
  "gymlil.de": MyTheme(
    primary: Color(0xFFA0242C),
    primaryText: Color(0xFFA0242C),
    primaryDesaturated: Color(0xFF914E53),
    secondary: Color(0xFFDBC146),
    secondaryDesaturated: Color(0xFFDFCD78),
    error: Color(0xFFA42B33),
    lightBg: Color(0xFFF9F9F9),
  ),
};

MyTheme getDefaultTheme() {
  return _themes["igslilienthal.de"]!;
}

MyTheme getTheme(String domain) {
  return _themes[domain] ?? getDefaultTheme();
}
