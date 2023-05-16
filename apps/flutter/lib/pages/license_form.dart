import 'package:class_mate/models/setup_store.dart';
import 'package:class_mate/openapi.dart';
import 'package:class_mate/pages/profile_setup_page.dart';
import 'package:class_mate/static/colors.dart';
import 'package:class_mate/static/theme.dart';
import 'package:class_mate/util/string_util.dart';
import 'package:flutter/services.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter/material.dart';

class LicenseFormatter extends TextInputFormatter {
  String formatLicense(String input) {
    return input
        .toUpperCase()
        .replaceAll(RegExp(r"[^A-Z0-9]"), "")
        .replaceAllMapped(RegExp(r".{4}"), (match) => "${match.group(0)}-")
        .limit(19);
  }

  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue oldValue, TextEditingValue newValue) {
    final oldDashesCount = oldValue.text.split(RegExp(r"[-—]")).length - 1;
    final newDashesCount = newValue.text.split(RegExp(r"[-—]")).length - 1;

    if (newDashesCount > oldDashesCount) {
      return oldValue;
    }
    if (newDashesCount < oldDashesCount) {
      return newValue.copyWith();
    }

    final newText = formatLicense(newValue.text);
    return newValue.copyWith(
        text: newText,
        selection: TextSelection.collapsed(offset: newText.length));
  }
}

class LicenseForm extends HookWidget {
  final SetupStore store;
  final void Function(Widget nextPage) onNext;

  const LicenseForm({super.key, required this.store, required this.onNext});

  @override
  Widget build(BuildContext context) {
    final licenseController =
        useTextEditingController(text: "KJ27-MP16-LS14-JM22");
    useListenable(licenseController);
    final loading = useState(false);
    final error = useState<String?>(null);
    final isValidInput = useState(false);

    useEffect(() {
      licenseController.addListener(() {
        isValidInput.value = licenseController.text.length == 19;
      });
      return null;
    }, [licenseController]);

    void onActivate() async {
      loading.value = true;
      error.value = null;

      final licenseKey = licenseController.text;
      final licenseStatus = await apiInstance
          .queryLicenseCheck(licenseKey)
          .then((value) => value?.replaceAll("\"", ""));
      if (licenseStatus == "VALID") {
        // License key will have to be checked again and activated when setup flow is completed

        store.licenseKey = licenseKey;

        onNext(ProfileSetupPage(
          store: store,
          onNext: onNext,
        ));
      } else if (licenseStatus == "INVALID") {
        error.value = "Ungültiger Lizenzschlüssel";
      } else if (licenseStatus == "ACTIVATED") {
        error.value = "Dieser Lizenzschlüssel wurde bereits verwendet";
      }

      loading.value = false;
    }

    final errorValue = error.value;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 36.0),
          child: Column(
            children: [
              Text(
                "Willkommen!",
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 8.0),
              Text(
                  "Bitte gib zunächst deinen Lizenzschlüssel ein, um fortzufahren und die App zu aktivieren. Du hast deinen Lizenzschlüssel von deinem Lehrer erhalten.",
                  style: Theme.of(context).textTheme.bodyMedium),
            ],
          ),
        ),
        errorValue == null
            ? Container()
            : Align(
                alignment: Alignment.centerLeft,
                child: Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 16.0),
                  padding: const EdgeInsets.symmetric(
                      vertical: 16.0, horizontal: 16.0),
                  decoration: BoxDecoration(
                      color: theme.error,
                      borderRadius: BorderRadius.circular(12.0)),
                  child: Text(
                    errorValue,
                    style: const TextStyle(color: Colors.white),
                  ),
                )),
        TextField(
          controller: licenseController,
          autocorrect: false,
          inputFormatters: [LicenseFormatter()],
          decoration: const InputDecoration(
              labelText: "Lizenzschlüssel", hintText: "XXXX-XXXX-XXXX-XXXX"),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 24.0),
          child: ContinueButton(
              isValidInput: isValidInput.value,
              loading: loading.value,
              onActivate: onActivate),
        )
      ],
    );
  }
}

class ContinueButton extends StatelessWidget {
  final bool isValidInput;
  final bool loading;
  final void Function() onActivate;

  const ContinueButton({
    super.key,
    required this.isValidInput,
    required this.loading,
    required this.onActivate,
  });

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          foregroundColor: Colors.white,
          disabledBackgroundColor: disabledColor,
        ),
        onPressed: isValidInput ? () => onActivate() : null,
        child: loading
            ? const CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                strokeWidth: 2,
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: const [
                  Text(
                    "WEITER",
                  ),
                  Icon(Icons.arrow_forward)
                ],
              ),
      ),
    );
  }
}
