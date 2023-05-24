import 'package:class_mate/hooks/use_network_result.dart';
import 'package:class_mate/models/setup_store.dart';
import 'package:class_mate/openapi.dart';
import 'package:class_mate/pages/classes_courses_setup_page.dart';
import 'package:class_mate/pages/license_form.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter/material.dart';

class ProfileSetupPage extends HookWidget {
  final SetupStore store;
  final void Function(Widget nextPage) onNext;

  const ProfileSetupPage(
      {super.key, required this.store, required this.onNext});

  @override
  Widget build(BuildContext context) {
    final years = useNetworkResult(() => apiInstance.queryYearsGet(),
            () => throw Exception("Jahrgänge konnten nicht geladen werden"))
      ?..sort((a, b) => -b.yearNumber.compareTo(a.yearNumber));
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
          DropdownButtonFormField(
            value: selectedYear.value,
            decoration: const InputDecoration(
              labelText: "Jahrgang",
            ),
            hint: const Text("Jahrgang"),
            items: years?.map((year) {
              return DropdownMenuItem(
                value: year,
                child: Text("${year.yearNumber} (${year.name})"),
              );
            }).toList(),
            onChanged: (value) {
              selectedYear.value = value;
            },
          ),
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
                onNext(ClassesCoursesSetupPage(store: store, onNext: onNext));
              })
        ],
      ),
    );
  }
}
