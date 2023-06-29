import 'package:class_mate/models/setup_store.dart';
import 'package:class_mate/pages/license_form.dart';
import 'package:class_mate/pages/profile_setup_page.dart';
import 'package:class_mate/pages/setup_page_layout.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:mobx/mobx.dart';

class WelcomePage extends HookWidget {
  final SetupStore? initialStore;

  const WelcomePage({super.key, this.initialStore});

  @override
  Widget build(BuildContext context) {
    final store = useState(
      initialStore ?? SetupStore(courses: ObservableList()),
    );

    final currentPage = useState<Widget?>(null);

    useEffect(() {
      if (store.value.licenseKey != null) {
        currentPage.value = ProfileSetupPage(
          onNext: (Widget nextPage) {
            currentPage.value = nextPage;
          },
          store: store.value,
        );
        return null;
      }

      currentPage.value = LicenseForm(
        onNext: (Widget nextPage) {
          currentPage.value = nextPage;
        },
        store: store.value,
      );
      return null;
    }, []);

    return SetupPageLayout(page: currentPage.value ?? Container());
  }
}
