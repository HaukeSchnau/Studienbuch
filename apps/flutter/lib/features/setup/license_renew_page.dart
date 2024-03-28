import 'package:class_mate/database/database.dart';
import 'package:class_mate/features/setup/forms/license_form.dart';
import 'package:class_mate/features/setup/helpers/setup_flow.dart';
import 'package:class_mate/infrastructure/hooks/use_async_effect.dart';
import 'package:class_mate/models/setup_store.dart';
import 'package:class_mate/infrastructure/openapi.dart';
import 'package:class_mate_api/api.dart';
import 'package:drift/drift.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:mobx/mobx.dart';
import 'package:sentry/sentry.dart';

class LicenseRenewPage extends HookWidget {
  const LicenseRenewPage({super.key});

  @override
  Widget build(BuildContext context) {
    useAsyncEffect(() async {
      Sentry.captureMessage("Showing license renew page. License has expired.");
    }, []);

    final setupStore = useState(
      SetupStore(courses: ObservableList()),
    );

    Future<void> finishFlow() async {
      final newLicenseKey = setupStore.value.licenseKey;
      if (newLicenseKey == null) {
        throw Exception("License key is null after license renew.");
      }

      await apiInstance
          .licenseActivate(LicenseActivateRequest(licenseKey: newLicenseKey));

      await db.update(db.users).write(UsersCompanion(
            licenseKey: Value(newLicenseKey),
            licenseKeyActivatedAt: Value(DateTime.now()),
          ));
    }

    Widget? nextPageCallback(Widget? currentPage) {
      if (currentPage is LicenseForm) {
        finishFlow();
        return null;
      }

      return LicenseForm(
        store: setupStore.value,
      );
    }

    return SetupFlow(nextPageCallback: nextPageCallback);
  }
}
