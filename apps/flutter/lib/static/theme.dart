import 'package:flutter/material.dart';
import 'package:class_mate/static/colors.dart';

TextTheme buildTextTheme(MyTheme theme) {
  return TextTheme(
    displaySmall: TextStyle(
        color: theme.primaryText, fontWeight: FontWeight.bold, fontSize: 38),
    headlineMedium: TextStyle(
        color: theme.primaryText, fontWeight: FontWeight.bold, fontSize: 30),
    labelLarge: const TextStyle(
      fontWeight: FontWeight.bold,
      color: Colors.white,
    ),
  );
}

ElevatedButtonThemeData buildButtonTheme(MyTheme theme) {
  return ElevatedButtonThemeData(
      style: ButtonStyle(
          shape: MaterialStateProperty.all(
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(500))),
          padding: MaterialStateProperty.all(
              const EdgeInsets.symmetric(horizontal: 24, vertical: 12)),
          backgroundColor: MaterialStateProperty.all(theme.secondary)));
}

const disabledColor = Color(0xFFE6E6E6);

ThemeData buildTheme(MyTheme theme) {
  return ThemeData(
    brightness: Brightness.light,
    useMaterial3: true,
    fontFamily: "Nunito",
    elevatedButtonTheme: buildButtonTheme(theme),
    inputDecorationTheme: InputDecorationTheme(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(50),
            borderSide: BorderSide.none),
        fillColor: disabledColor,
        filled: true),
    scaffoldBackgroundColor: Colors.white,
    textTheme: buildTextTheme(theme),
    appBarTheme: AppBarTheme(
        backgroundColor: theme.primary,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        titleTextStyle: const TextStyle(
            fontFamily: "Nunito",
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.bold)),
    colorScheme:
        ColorScheme.light(primary: theme.primary, secondary: theme.secondary),
  );
}
