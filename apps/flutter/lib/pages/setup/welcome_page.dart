import 'package:class_mate/hooks/use_async_effect.dart';
import 'package:class_mate/models/setup_store.dart';
import 'package:class_mate/openapi.dart';
import 'package:class_mate/pages/setup/forms/classes_courses_setup_page.dart';
import 'package:class_mate/pages/setup/forms/license_form.dart';
import 'package:class_mate/pages/setup/forms/profile_setup_page.dart';
import 'package:class_mate/pages/setup/helpers/setup_flow.dart';
import 'package:class_mate_api/api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:mobx/mobx.dart';
import 'package:sentry/sentry.dart';

class WelcomePage extends HookWidget {
  const WelcomePage({super.key});

  @override
  Widget build(BuildContext context) {
    useAsyncEffect(() async {
      await Sentry.captureMessage(
          "Showing welcome page. This should only happen once per device.");
    }, []);

    final storeState = useState(
      SetupStore(courses: ObservableList()),
    );

    Future<void> finishFlow() async {
      final store = storeState.value;
      await apiInstance.mutationLicenseActivate(
          MutationLicenseActivateRequest(licenseKey: store.licenseKey!));

      await store.saveToDatabase();

      await Sentry.captureMessage(
          "Finished setup flow and saved store & database. License key: ${store.licenseKey}");
    }

    Widget? nextPageCallback(Widget? currentPage) {
      switch (currentPage.runtimeType) {
        case ClassesCoursesSetupPage:
          finishFlow();
          return null;
        case ProfileSetupPage:
          return ClassesCoursesSetupPage(store: storeState.value);
        case LicenseForm:
          return ProfileSetupPage(
            store: storeState.value,
          );
        default:
          return LicenseForm(
            store: storeState.value,
          );
      }
    }

    return SetupFlow(nextPageCallback: nextPageCallback);
  }
}
