import 'package:class_mate/api/types.dart';
import 'package:class_mate/features/setup/helpers/setup_flow.dart';
import 'package:class_mate/infrastructure/api.dart';
import 'package:class_mate/infrastructure/error_catcher.dart';
import 'package:class_mate/infrastructure/hooks/use_has_network.dart';
import 'package:class_mate/models/setup_store.dart';
import 'package:class_mate/presentation/colors.dart';
import 'package:class_mate/presentation/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:http/http.dart';
import 'package:mask_text_input_formatter/mask_text_input_formatter.dart';
import 'package:provider/provider.dart';

class LicenseFormatter extends MaskTextInputFormatter {
  LicenseFormatter()
      : super(
          mask: "XXXX-XXXX-XXXX-XXXX",
          filter: {"X": RegExp(r"[A-Za-z0-9]")},
        );

  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue oldValue, TextEditingValue newValue) {
    return super.formatEditUpdate(
        oldValue, newValue.copyWith(text: newValue.text.toUpperCase()));
  }
}

class LicenseForm extends HookWidget {
  final SetupStore store;

  const LicenseForm({super.key, required this.store});

  @override
  Widget build(BuildContext context) {
    final licenseController = useTextEditingController();
    useListenable(licenseController);
    final loading = useState(false);
    final error = useState<String?>(null);
    final isValidInput = useState(false);
    final hasNetwork = useHasNetworkWithNotice();
    final formatter = useRef(LicenseFormatter());

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

      try {
        final licenseStatus = await api.license.check(licenseKey: licenseKey);

        if (licenseStatus == LicenseCheckOutputEnum.valid) {
          // License key will have to be checked again and activated when setup flow is completed

          store.licenseKey = licenseKey;
          store.licenseKeyActivatedAt = DateTime.now();

          // ignore: use_build_context_synchronously
          final onNext = context.read<OnNext>();
          onNext();
        } else if (licenseStatus == LicenseCheckOutputEnum.invalid) {
          error.value = "Ungültiger Lizenzschlüssel";
          // } else if (licenseStatus == "ACTIVATED") {
          //   error.value = "Dieser Lizenzschlüssel wurde bereits verwendet";
        }
      } on ClientException catch (_) {
        loading.value = false;

        showError(
            context,
            (UserVisibleError(
              "Du bist offline. Bitte überprüfe deine Internetverbindung.",
            )));
      } catch (error) {
        loading.value = false;

        showError(
            context,
            (UserVisibleError(
              "Lizenzschlüssel konnte nicht geprüft werden",
            )));

        rethrow;
      } finally {
        loading.value = false;
      }
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
                  "Bitte gib zunächst deinen Lizenzschlüssel ein, um fortzufahren und die App zu aktivieren. Du hast deinen Lizenzschlüssel von deiner Lehrkraft erhalten.",
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
          inputFormatters: [formatter.value],
          decoration: const InputDecoration(
              labelText: "Lizenzschlüssel", hintText: "XXXX-XXXX-XXXX-XXXX"),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 24.0),
          child: ContinueButton(
              enabled: isValidInput.value && hasNetwork,
              loading: loading.value,
              onActivate: onActivate),
        )
      ],
    );
  }
}

class ContinueButton extends StatelessWidget {
  final bool enabled;
  final bool loading;
  final void Function() onActivate;

  const ContinueButton({
    super.key,
    required this.enabled,
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
        onPressed: enabled ? () => onActivate() : null,
        child: loading
            ? const CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                strokeWidth: 2,
              )
            : const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
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
