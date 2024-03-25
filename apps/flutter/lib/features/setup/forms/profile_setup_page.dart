import 'package:class_mate/features/setup/forms/license_form.dart';
import 'package:class_mate/features/setup/helpers/setup_flow.dart';
import 'package:class_mate/infrastructure/error_catcher.dart';
import 'package:class_mate/infrastructure/hooks/use_network_result.dart';
import 'package:class_mate/models/setup_store.dart';
import 'package:class_mate/infrastructure/openapi.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class ProfileSetupPage extends HookWidget {
  final SetupStore store;

  const ProfileSetupPage({super.key, required this.store});

  @override
  Widget build(BuildContext context) {
    final selectedYear = useState<ApiYear?>(store.year);
    final isOfAge = useState(false);
    final nameController = useTextEditingController(text: store.name);
    useListenable(nameController);

    bool isValidInput() {
      return nameController.text.trim().isNotEmpty &&
          selectedYear.value != null;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 36.0),
      child: Column(
        children: [
          Text(
            "Willkommen!",
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 8.0),
          Text("Bitte gib deinen Namen und deinen Jahrgang an.",
              style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 16.0),
          TextField(
            autofocus: true,
            decoration: const InputDecoration(
              labelText: "Name",
            ),
            controller: nameController,
          ),
          const SizedBox(height: 16.0),
          YearSelector(
              selectedYear: selectedYear.value,
              onChange: (newYear) => selectedYear.value = newYear),
          const SizedBox(height: 8.0),
          // Checkbox
          CheckboxListTile(
            title: const Text("Ich bin volljährig."),
            value: isOfAge.value,
            onChanged: (value) {
              isOfAge.value = value ?? false;
            },
          ),
          const SizedBox(height: 8.0),
          ContinueButton(
              isValidInput: isValidInput(),
              loading: false,
              onActivate: () {
                store.name = nameController.text.trim();
                store.year = selectedYear.value;
                store.isOfAge = isOfAge.value;

                final onNext = context.read<OnNext>();
                onNext();
              })
        ],
      ),
    );
  }
}

class YearSelector extends HookWidget {
  final ApiYear? selectedYear;
  final void Function(ApiYear? newYear) onChange;

  const YearSelector(
      {super.key, required this.onChange, required this.selectedYear});

  @override
  Widget build(BuildContext context) {
    final years = useNetworkResult(
        () => apiInstance.yearsGet(),
        (error) => throw UserException(
            "Jahrgänge konnten nicht geladen werden", error))
      ?..sort((a, b) => -b.yearNumber.compareTo(a.yearNumber));

    if (years == null) {
      return const Padding(
        padding: EdgeInsets.all(8.0),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    return DropdownButtonFormField(
        value: selectedYear,
        decoration: const InputDecoration(
          labelText: "Jahrgang",
        ),
        hint: const Text("Jahrgang"),
        items: years.map((year) {
          return DropdownMenuItem(
            value: year,
            child: Text("${year.yearNumber} (${year.name})"),
          );
        }).toList(),
        onChanged: onChange);
  }
}
