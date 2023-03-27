import 'package:class_companion/hooks/use_disposable.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
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

    return Scaffold(
        appBar: AppBar(
          title: Text(title),
        ),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Builder(builder: builder),
                const SizedBox(height: 16),
                Expanded(
                  child: Stack(
                    children: [
                      Signature(
                        controller: signatureController,
                        backgroundColor: Colors.transparent,
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
                      const Positioned(
                        bottom: 16,
                        left: 8,
                        child: Icon(
                          Icons.close_rounded,
                          color: Colors.black87,
                          size: 32,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Align(
                  alignment: Alignment.centerRight,
                  child: Text(signer,
                      style:
                          const TextStyle(color: Colors.black54, fontSize: 16)),
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
        ));
  }
}

Future<String?> confirmWithSignature(
    BuildContext context,
    Widget Function(BuildContext context) builder,
    String title,
    String signer) async {
  final result = await Navigator.of(context).push<String>(
    MaterialPageRoute(
      builder: (context) => ConfirmWithSignature(
        builder: builder,
        title: title,
        signer: signer,
      ),
    ),
  );
  return result;
}
