import 'package:class_mate/models/setup_store.dart';
import 'package:class_mate/models/store.dart';
import 'package:class_mate/openapi.dart';
import 'package:class_mate/pages/setup/forms/license_form.dart';
import 'package:class_mate/pages/setup/helpers/setup_flow.dart';
import 'package:class_mate_api/api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:mobx/mobx.dart';

class LicenseRenewPage extends HookWidget {
  final GlobalStore store;

  const LicenseRenewPage({super.key, required this.store});

  @override
  Widget build(BuildContext context) {
    final setupStore = useState(
      SetupStore(courses: ObservableList()),
    );

    Future<void> finishFlow() async {
      final newLicenseKey = setupStore.value.licenseKey;
      if (newLicenseKey == null) {
        return;
      }

      await apiInstance.mutationLicenseActivate(
          MutationLicenseActivateRequest(licenseKey: newLicenseKey));

      store.licenseKey = newLicenseKey;
      store.licenseKeyActivatedAt = DateTime.now();
    }

    Widget? nextPageCallback(Widget? currentPage) {
      switch (currentPage.runtimeType) {
        case LicenseForm:
          finishFlow();
          return null;
        default:
          return LicenseForm(
            store: setupStore.value,
          );
      }
    }

    return SetupFlow(nextPageCallback: nextPageCallback);
  }
}
