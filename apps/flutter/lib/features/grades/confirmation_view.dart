import 'dart:io';

import 'package:class_mate/database/database.dart';
import 'package:class_mate/features/absences/absence.dart';
import 'package:class_mate/infrastructure/hooks/use_app_dir.dart';
import 'package:class_mate/infrastructure/util/date_util.dart';
import 'package:class_mate/infrastructure/util/number_util.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/presentation/colors.dart';
import 'package:class_mate/features/grades/confirmation_info.dart';
import 'package:class_mate/presentation/components/simple_scaffold.dart';
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
  final File signatureFile;

  const SignatureView(
      {super.key, required this.signer, required this.signatureFile});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SizedBox(
          height: 200,
          width: double.infinity,
          child: Stack(
            children: [
              Positioned.fill(
                child: SvgPicture.file(
                  signatureFile,
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
  final ConfirmationWrapper confirmation;

  const ConfirmationView({super.key, required this.confirmation});

  @override
  Widget build(BuildContext context) {
    final file = useFile(confirmation.fileName);

    if (file == null) {
      return const SizedBox();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        confirmation.builder(context),
        SignatureView(signer: confirmation.signer, signatureFile: file),
        const SizedBox(height: 64),
      ],
    );
  }
}

class ConfirmationsView extends HookWidget {
  final String title;
  final List<ConfirmationWrapper> confirmations;
  final List<Widget>? children;

  const ConfirmationsView({
    super.key,
    required this.confirmations,
    required this.title,
    this.children,
  });

  @override
  Widget build(BuildContext context) {
    return SimpleScaffold(
        scroll: true,
        appBar: AppBar(
          title: Text(title),
        ),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: confirmations
                    .map<Widget>((confirmation) =>
                        ConfirmationView(confirmation: confirmation))
                    .toList()
                  ..addAll(children ?? [])),
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
      builder: (context) => ConfirmationsView(
        title: "Fehlzeit",
        confirmations: [
          if (!user.isOfAge)
            ConfirmationWrapper(
                signer: "Eltern",
                builder: (ctx) =>
                    buildAbsenceInfoParent(absenceGroup, user, viewOnly: true),
                fileName: "absence-excuse-${absence.id}-parent.svg"),
          ConfirmationWrapper(
              signer: absence.course.teacher.longFormalName,
              builder: (ctx) =>
                  buildAbsenceInfoTeacher(absence, user, viewOnly: true),
              fileName: "absence-excuse-${absence.id}-teacher.svg")
        ],
      ),
    ),
  );
}

Future<void> viewOralGradeConfirmation(
    BuildContext context, Course course, User user, GradeResult result,
    [List<GradeResult>? previousResults]) async {
  await Navigator.of(context).push(
    MaterialPageRoute(
      builder: (context) => ConfirmationsView(
          title: "Mündliche Note",
          confirmations: [
            ConfirmationWrapper(
                signer: course.teacher.longFormalName,
                builder: (ctx) => buildOralGradeConfirmationInfoTeacher(
                    course, user, result,
                    viewOnly: true),
                fileName: "signature-${result.id}-teacher.svg"),
            if (!user.isOfAge)
              ConfirmationWrapper(
                  signer: "Eltern",
                  builder: (ctx) => buildOralGradeConfirmationInfoParent(
                      course, user, result,
                      viewOnly: true),
                  fileName: "signature-${result.id}-parent.svg")
          ],
          children: previousResults == null
              ? []
              : [
                  const Text("Vorherige mündliche Noten",
                      style:
                          TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  ...previousResults.map((previousResult) =>
                      PreviousGradeView(result: previousResult))
                ]),
    ),
  );
}

Future<void> viewMasterGradeConfirmation(
    BuildContext context, Course course, User user, GradeResult result,
    [List<GradeResult>? previousResults]) async {
  await Navigator.of(context).push(
    MaterialPageRoute(
      builder: (context) => ConfirmationsView(
          title: "Gesamtnote",
          confirmations: [
            ConfirmationWrapper(
                signer: course.teacher.longFormalName,
                builder: (ctx) => buildMasterGradeConfirmationInfoTeacher(
                    course, user, result,
                    viewOnly: true),
                fileName: "signature-${result.id}-teacher.svg"),
            if (!user.isOfAge)
              ConfirmationWrapper(
                  signer: "Eltern",
                  builder: (ctx) => buildMasterGradeConfirmationInfoParent(
                      course, user, result,
                      viewOnly: true),
                  fileName: "signature-${result.id}-parent.svg")
          ],
          children: previousResults == null
              ? []
              : [
                  const Text("Vorherige mündliche Noten",
                      style:
                          TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  ...previousResults.map((previousResult) =>
                      PreviousGradeView(result: previousResult))
                ]),
    ),
  );
}

class PreviousGradeView extends StatelessWidget {
  final GradeResult result;

  const PreviousGradeView({super.key, required this.result});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(Icons.verified_rounded, color: theme.primaryText),
      title: Text(result.result.formatAsGrade()),
      subtitle: Text(result.date.format()),
    );
  }
}

Future<void> viewWrittenGradeConfirmation(
    BuildContext context, Course course, User user, GradeResult result) async {
  await Navigator.of(context).push(
    MaterialPageRoute(
      builder: (context) => ConfirmationsView(
        title: "Schriftliche Note",
        confirmations: [
          ConfirmationWrapper(
              signer: course.teacher.longFormalName,
              builder: (ctx) => buildWrittenGradeConfirmationInfoTeacher(
                  course, user, result,
                  viewOnly: true),
              fileName: "signature-${result.id}-teacher.svg"),
          if (!user.isOfAge)
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
