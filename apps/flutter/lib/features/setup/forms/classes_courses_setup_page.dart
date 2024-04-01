import 'package:class_mate/api/types.dart';
import 'package:class_mate/features/setup/forms/license_form.dart';
import 'package:class_mate/features/setup/helpers/setup_flow.dart';
import 'package:class_mate/infrastructure/api.dart';
import 'package:class_mate/infrastructure/error_catcher.dart';
import 'package:class_mate/infrastructure/hooks/use_network_result.dart';
import 'package:class_mate/models/setup_store.dart';
import 'package:class_mate/features/courses/course_selector.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:mobx/mobx.dart';
import 'package:provider/provider.dart';

typedef Class = ClassesListOutput;
typedef Course = CoursesListOutput;

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

  const ClassesCoursesSetupPage({super.key, required this.store});

  @override
  Widget build(BuildContext context) {
    final year = store.year!;

    void finishFlow(Class selectedClass, List<Course> selectedCourses) async {
      store.class_ = selectedClass;
      store.courses = selectedCourses.asObservable();

      final onNext = context.read<OnNext>();
      onNext();
    }

    return ClassesCoursesChooserPage(
        year: year, onFinishedCallback: finishFlow);
  }
}

class ClassesCoursesChooserPage extends HookWidget {
  final YearsGetOutput year;
  final void Function(
    Class selectedClass,
    List<Course> selectedCourses,
  ) onFinishedCallback;

  const ClassesCoursesChooserPage(
      {super.key, required this.year, required this.onFinishedCallback});

  @override
  Widget build(BuildContext context) {
    final classesData = useNetworkResult(
        () => api.classes.list(yearId: year.id),
        (e, trace) => throw UserException(
            "Klassen konnten nicht geladen werden", e, trace),
        [year.id]);
    final coursesData = useNetworkResult(
        () => api.courses.list(yearId: year.id),
        (e, trace) =>
            throw UserException("Kurse konnten nicht geladen werden", e, trace),
        [year.id]);

    final loading = classesData == null || coursesData == null;
    final hasClasses = classesData != null && classesData.length > 1;

    final selectedClass = useState<Class?>(null);
    final selectedCourses = useState<Map<String, Course?>>({});
    final courseChoices = useState<Map<String, List<Course>>>({});

    useEffect(() {
      if (!hasClasses && classesData != null) {
        selectedClass.value = classesData[0];
      }
      return null;
    }, [classesData, hasClasses]);

    useEffect(() {
      final choosableCourses = groupCoursesByName(coursesData
              ?.where((course) =>
                  course.isChoosable &&
                  course.classId == selectedClass.value?.id)
              .toList() ??
          []);

      courseChoices.value = choosableCourses;

      for (final courseName in choosableCourses.keys) {
        selectedCourses.value[courseName] = null;
      }
      return null;
    }, [coursesData, selectedClass.value]);

    bool isValidInput() {
      return selectedClass.value != null;
    }

    void finishFlow() {
      final class_ = selectedClass.value;
      final courses = selectedCourses.value.values.whereType<Course>().toList();
      onFinishedCallback(class_!, courses);
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
          if (loading) const Center(child: CircularProgressIndicator()),
          if (hasClasses)
            DropdownButtonFormField(
              decoration: const InputDecoration(
                labelText: "Klasse",
              ),
              hint: const Text("Klasse"),
              items: classesData.map((class_) {
                return DropdownMenuItem(
                  value: class_,
                  child: Text("${year.yearNumber}.${class_.identifierInYear}"),
                );
              }).toList(),
              onChanged: (value) {
                selectedClass.value = value;
              },
            ),
          if (hasClasses) const SizedBox(height: 16.0),
          if (courseChoices.value.isNotEmpty)
            GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 16.0,
                mainAxisSpacing: 16.0,
                childAspectRatio: 1 / .5,
                children: [
                  for (final courses in courseChoices.value.values)
                    CourseSelector(
                        courses: courses,
                        selectedCourse: selectedCourses.value[courses[0].name],
                        onCourseSelected: (course) {
                          selectedCourses.value[courses[0].name] = course;
                          // rerender
                          selectedCourses.value = {...selectedCourses.value};
                        })
                ]),
          if (courseChoices.value.isNotEmpty) const SizedBox(height: 16.0),
          ContinueButton(
              isValidInput: isValidInput(),
              loading: false,
              onActivate: finishFlow)
        ],
      ),
    );
  }
}
