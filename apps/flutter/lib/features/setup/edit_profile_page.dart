import 'package:class_mate/features/setup/forms/classes_courses_setup_page.dart';
import 'package:class_mate/features/setup/forms/profile_setup_page.dart';
import 'package:class_mate/features/setup/helpers/setup_flow.dart';
import 'package:class_mate/models/setup_store.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class EditProfilePage extends HookWidget {
  final SetupStore initialStore;
  final VoidCallback onFinished;

  const EditProfilePage(
      {super.key, required this.initialStore, required this.onFinished});

  @override
  Widget build(BuildContext context) {
    final storeState = useState(
      initialStore,
    );

    Future<void> finishFlow() async {
      final store = storeState.value;
      await store.saveToDatabase();

      onFinished();
    }

    Widget? nextPageCallback(Widget? currentPage) {
      if (currentPage is ProfileSetupPage) {
        return ClassesCoursesSetupPage(store: storeState.value);
      }

      if (currentPage is ClassesCoursesSetupPage) {
        finishFlow();
        return null;
      }

      return ProfileSetupPage(
        store: storeState.value,
      );
    }

    return SetupFlow(nextPageCallback: nextPageCallback);
  }
}
