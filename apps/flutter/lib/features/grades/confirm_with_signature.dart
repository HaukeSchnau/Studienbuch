import 'dart:io';

import 'package:class_mate/infrastructure/hooks/use_disposable.dart';
import 'package:class_mate/presentation/components/simple_scaffold.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter_svg/svg.dart';
import 'package:path_provider/path_provider.dart';
import 'package:signature/signature.dart';

class ConfirmWithSignature extends HookWidget {
  final String title;
  final String signer;
  final Widget Function(BuildContext context) builder;

  const ConfirmWithSignature(
      {super.key,
      required this.builder,
      required this.title,
      required this.signer});

  @override
  Widget build(BuildContext context) {
    final signatureController = useDisposable(() => SignatureController(
          exportPenColor: Colors.black,
          exportBackgroundColor: Colors.white,
          penColor: Colors.black,
        ));
    final image = useState<SvgPicture?>(null);

    openFullscreenSignature() {
      Navigator.of(context)
          .push(MaterialPageRoute(
              builder: (context) => FullscreenSignature(
                    signatureController: signatureController,
                  )))
          .then((value) async => image.value = signatureController.toSVG());
    }

    return SimpleScaffold(
        appBar: AppBar(
          title: Text(title),
        ),
        body: SafeArea(
          child: SingleChildScrollView(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Builder(builder: builder),
                  const SizedBox(height: 16),
                  GestureDetector(
                    onTap: openFullscreenSignature,
                    onPanStart: (_) => openFullscreenSignature(),
                    child: Container(
                      clipBehavior: Clip.hardEdge,
                      decoration: BoxDecoration(
                        color: Colors.grey[50],
                      ),
                      height: 200,
                      child: Stack(
                        children: [
                          Positioned(
                            bottom: 0,
                            left: 0,
                            right: 0,
                            top: 0,
                            child: image.value ?? Container(),
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
                          ),
                          Positioned(
                            bottom: 16,
                            right: 8,
                            child: Text(signer,
                                style: const TextStyle(
                                    color: Colors.black54, fontSize: 16)),
                          )
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Align(
                    alignment: Alignment.centerRight,
                    child: Text("(Tippe auf das Feld, um zu unterschreiben)",
                        style: const TextStyle(
                            fontStyle: FontStyle.italic, fontSize: 14)),
                  ),
                  const SizedBox(height: 64),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton(
                          onPressed: () => Navigator.of(context).pop(),
                          child: const Text("Abbrechen")),
                      const SizedBox(width: 8),
                      FilledButton(
                          onPressed: () => Navigator.of(context)
                              .pop(signatureController.toRawSVG()),
                          child: const Text("Bestätigen")),
                    ],
                  )
                ],
              ),
            ),
          ),
        ));
  }
}

Future<void> confirmWithSignature(
    BuildContext context, Widget Function(BuildContext context) builder,
    {required String title,
    required String signer,
    String? fileName,
    List<String>? fileNames,
    required VoidCallback onSuccess}) async {
  final signatureSvg = await Navigator.of(context).push<String>(
    MaterialPageRoute(
      builder: (context) => ConfirmWithSignature(
        builder: builder,
        title: title,
        signer: signer,
      ),
    ),
  );

  if (signatureSvg != null) {
    if (fileName != null) {
      final directory = await getApplicationDocumentsDirectory();
      final file = File("${directory.path}/$fileName");

      await file.writeAsString(signatureSvg);
    }
    if (fileNames != null) {
      final directory = await getApplicationDocumentsDirectory();
      for (final fileName in fileNames) {
        final file = File("${directory.path}/$fileName");

        await file.writeAsString(signatureSvg);
      }
    }
    onSuccess();
  }
}

class FullscreenSignature extends HookWidget {
  final SignatureController signatureController;

  const FullscreenSignature({super.key, required this.signatureController});

  @override
  Widget build(BuildContext context) {
    useEffect(() {
      SystemChrome.setPreferredOrientations([
        DeviceOrientation.landscapeRight,
        DeviceOrientation.landscapeLeft,
      ]);

      return () {
        SystemChrome.setPreferredOrientations([
          DeviceOrientation.portraitUp,
          DeviceOrientation.portraitDown,
        ]);
      };
    }, []);

    return Scaffold(
        body: SafeArea(
          child: Signature(
            controller: signatureController,
            backgroundColor: Colors.white,
          ),
        ),
        floatingActionButton: FloatingActionButton(
          onPressed: () => Navigator.of(context).pop(),
          shape: const CircleBorder(),
          child: const Icon(Icons.check),
        ));
  }
}
