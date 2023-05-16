import 'dart:io';

import 'package:class_companion/components/confirmation_info.dart';
import 'package:class_companion/database.dart';
import 'package:class_companion/hooks/use_app_dir.dart';
import 'package:class_companion/models/absence.dart';
import 'package:class_companion/models/course.dart';
import 'package:class_companion/models/user.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter_svg/flutter_svg.dart';

class ConfirmationWrapper {
  final String signer;
  final Widget Function(BuildContext) builder;
  final String fileName;

  const ConfirmationWrapper(
      {required this.signer, required this.builder, required this.fileName});
}

class SignatureView extends HookWidget {
  final String signer;
  final String fileName;

  const SignatureView(
      {super.key, required this.signer, required this.fileName});

  @override
  Widget build(BuildContext context) {
    final appDir = useAppDir();

    if (appDir == null) {
      return const SizedBox();
    }

    return Column(
      children: [
        SizedBox(
          height: 150,
          width: double.infinity,
          child: Stack(
            children: [
              Positioned.fill(
                child: SvgPicture.file(
                  File("$appDir/$fileName"),
                  // ignore: deprecated_member_use
                  color: Colors.black,
                ),
              ),
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Container(
                  height: 1,
                  color: Colors.grey,
                ),
              ),
              Positioned(
                bottom: 16,
                left: 8,
                child: SvgPicture.asset(
                  "assets/icons/cross.svg",
                  // ignore: deprecated_member_use
                  color: Colors.black54,
                  width: 32,
                ),
              )
            ],
          ),
        ),
        const SizedBox(height: 16),
        Align(
          alignment: Alignment.centerRight,
          child: Text(signer,
              style: const TextStyle(color: Colors.black54, fontSize: 16)),
        ),
      ],
    );
  }
}

class ConfirmationView extends HookWidget {
  final String title;
  final List<ConfirmationWrapper> confirmations;

  const ConfirmationView({
    super.key,
    required this.confirmations,
    required this.title,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          title: Text(title),
        ),
        body: SingleChildScrollView(
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: confirmations
                    .map((confirmation) => [
                          confirmation.builder(context),
                          SignatureView(
                              signer: confirmation.signer,
                              fileName: confirmation.fileName),
                          const SizedBox(height: 64),
                        ])
                    .expand((element) => element)
                    .toList(),
              ),
            ),
          ),
        ));
  }
}

Future<void> viewAbsenceConfirmation(
    BuildContext context, AbsenceGroup absenceGroup, User user) async {
  assert(absenceGroup.children.length == 1);

  final absence = absenceGroup.children.first;

  await Navigator.of(context).push(
    MaterialPageRoute(
      builder: (context) => ConfirmationView(
        title: "Fehlzeit",
        confirmations: [
          ConfirmationWrapper(
              signer: "Eltern",
              builder: (ctx) =>
                  buildAbsenceInfoParent(absenceGroup, user, viewOnly: true),
              fileName: "absence-excuse-${absence.id}-parent.svg"),
          ConfirmationWrapper(
              signer: absence.course.teacher.name,
              builder: (ctx) =>
                  buildAbsenceInfoTeacher(absence, user, viewOnly: true),
              fileName: "absence-excuse-${absence.id}-teacher.svg")
        ],
      ),
    ),
  );
}

Future<void> viewOralGradeConfirmation(
    BuildContext context, Course course, User user, GradeResult result) async {
  await Navigator.of(context).push(
    MaterialPageRoute(
      builder: (context) => ConfirmationView(
        title: "Mündliche Note",
        confirmations: [
          ConfirmationWrapper(
              signer: course.teacher.name,
              builder: (ctx) => buildOralGradeConfirmationInfoTeacher(
                  course, user, result,
                  viewOnly: true),
              fileName: "signature-${result.id}-teacher.svg"),
          ConfirmationWrapper(
              signer: "Eltern",
              builder: (ctx) => buildOralGradeConfirmationInfoParent(
                  course, user, result,
                  viewOnly: true),
              fileName: "signature-${result.id}-parent.svg")
        ],
      ),
    ),
  );
}

Future<void> viewWrittenGradeConfirmation(
    BuildContext context, Course course, User user, GradeResult result) async {
  await Navigator.of(context).push(
    MaterialPageRoute(
      builder: (context) => ConfirmationView(
        title: "Schriftliche Note",
        confirmations: [
          ConfirmationWrapper(
              signer: course.teacher.name,
              builder: (ctx) => buildWrittenGradeConfirmationInfoTeacher(
                  course, user, result,
                  viewOnly: true),
              fileName: "signature-${result.id}-teacher.svg"),
          ConfirmationWrapper(
              signer: "Eltern",
              builder: (ctx) => buildWrittenGradeConfirmationInfoParent(
                  course, user, result,
                  viewOnly: true),
              fileName: "signature-${result.id}-parent.svg")
        ],
      ),
    ),
  );
}
