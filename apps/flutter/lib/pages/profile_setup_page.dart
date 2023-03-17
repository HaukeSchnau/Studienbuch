import 'package:class_companion/hooks/use_network_result.dart';
import 'package:class_companion/models/setup_store.dart';
import 'package:class_companion/openapi.dart';
import 'package:class_companion/pages/classes_courses_setup_page.dart';
import 'package:class_companion/pages/license_form.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter/material.dart';

class ProfileSetupPage extends HookWidget {
  final SetupStore store;
  final void Function(Widget nextPage) onNext;

  const ProfileSetupPage(
      {super.key, required this.store, required this.onNext});

  @override
  Widget build(BuildContext context) {
    final years = useNetworkResult(() => apiInstance.queryYearsGet());
    final selectedYear = useState<ApiYear?>(null);
    final isOfAge = useState(false);
    final nameController = useTextEditingController();

    bool isValidInput() {
      return nameController.text.trim().isNotEmpty &&
          selectedYear.value != null;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 36.0),
      child: Column(
        children: [
          Text(
            "Profil",
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
                store.name = nameController.text;
                store.year = selectedYear.value;
                store.isOfAge = isOfAge.value;
                onNext(ClassesCoursesSetupPage(store: store, onNext: onNext));
              })
        ],
      ),
    );
  }
}
