import 'package:class_companion/components/course_selector.dart';
import 'package:class_companion/hooks/use_network_result.dart';
import 'package:class_companion/main.dart';
import 'package:class_companion/models/setup_store.dart';
import 'package:class_companion/openapi.dart';
import 'package:class_companion/pages/license_form.dart';
import 'package:class_companion_api/api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:mobx/mobx.dart';
import 'package:provider/provider.dart';

typedef Class = QueryClassesGet200ResponseInner;
typedef Course = QueryCoursesGet200ResponseInner;

Map<String, List<Course>> groupCoursesByName(List<Course> courses) {
  final groupedCourses = <String, List<Course>>{};
  for (final course in courses) {
    if (groupedCourses.containsKey(course.name)) {
      groupedCourses[course.name]!.add(course);
    } else {
      groupedCourses[course.name] = [course];
    }
  }
  return groupedCourses;
}

class ClassesCoursesSetupPage extends HookWidget {
  final SetupStore store;
  final void Function(Widget nextPage) onNext;

  const ClassesCoursesSetupPage(
      {super.key, required this.store, required this.onNext});

  @override
  Widget build(BuildContext context) {
    final year = store.year!;
    final classes =
        useNetworkResult(() => apiInstance.queryClassesGet(year.id), [year.id]);
    final courses =
        useNetworkResult(() => apiInstance.queryCoursesGet(year.id), [year.id]);

    final courseChoices = useMemoized(() {
      return groupCoursesByName(
          courses?.where((course) => course.classId == null).toList() ?? []);
    }, [courses]);

    bool hasClasses = classes == null ? false : classes.length > 1;

    final selectedClass = useState<Class?>(null);
    final selectedCourses = useState<Map<String, Course?>>({});

    useEffect(() {
      for (final courseName in courseChoices.keys) {
        selectedCourses.value[courseName] = null;
      }
      return null;
    }, [courseChoices]);

    useEffect(() {
      if (!hasClasses && classes != null) {
        selectedClass.value = classes[0];
      }
      return null;
    }, [classes, hasClasses]);

    bool isValidInput() {
      return selectedClass.value != null;
    }

    void finishFlow() async {
      store.class_ = selectedClass.value;
      store.courses = selectedCourses.value.values
          .whereType<Course>()
          .toList()
          .asObservable();
      await apiInstance.mutationLicenseActivate(
          MutationLicenseActivateRequest(licenseKey: store.licenseKey!));

      final globalStore = store.toGlobalStore();
      await globalStore.save();

      // ignore: use_build_context_synchronously
      final onSetupFinished = context.read<SetupFinishedCallback>();
      onSetupFinished(globalStore);
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 36.0),
      child: Column(
        children: [
          Text(
            hasClasses ? "Klassen und Kurse" : "Kurse",
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 8.0),
          Text(
              hasClasses
                  ? "Bitte wähle deine Klasse und deine Wahlpflichtkurse aus. Du kannst diese später jederzeit ändern. Tippe auf die Fächer, um deine Kurse auszuwählen."
                  : "Bitte wähle deine Kurse aus. Du kannst diese später jederzeit ändern. Tippe auf die Fächer, um deine Kurse auszuwählen.",
              style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 16.0),
          if (hasClasses)
            DropdownButtonFormField(
              decoration: const InputDecoration(
                labelText: "Klasse",
              ),
              hint: const Text("Klasse"),
              items: classes.map((class_) {
                return DropdownMenuItem(
                  value: class_,
                  child: Text("${year.yearNumber}.${class_.identifierInYear}"),
                );
              }).toList(),
              onChanged: (value) {
                selectedClass.value = value;
              },
            ),
          GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 16.0,
              mainAxisSpacing: 16.0,
              childAspectRatio: 1 / .5,
              children: [
                for (final courses in courseChoices.values)
                  CourseSelector(
                      courses: courses,
                      selectedCourse: selectedCourses.value[courses[0].name],
                      onCourseSelected: (course) {
                        selectedCourses.value[courses[0].name] = course;
                        // rerender
                        selectedCourses.value = {...selectedCourses.value};
                      })
              ]),
          const SizedBox(height: 16.0),
          ContinueButton(
              isValidInput: isValidInput(),
              loading: false,
              onActivate: finishFlow)
        ],
      ),
    );
  }
}
