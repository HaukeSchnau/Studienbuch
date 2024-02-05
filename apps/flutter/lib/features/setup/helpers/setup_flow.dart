import 'package:class_mate/features/setup/helpers/setup_page_layout.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:provider/provider.dart';

typedef SetupFlowNextPageCallback = Widget? Function(Widget? currentPage);
typedef OnNext = void Function();

class SetupFlow extends HookWidget {
  final SetupFlowNextPageCallback nextPageCallback;

  const SetupFlow({
    super.key,
    required this.nextPageCallback,
  });

  @override
  Widget build(BuildContext context) {
    final currentPage = useState<Widget>(nextPageCallback(null)!);

    onNext() {
      final nextPage = nextPageCallback(currentPage.value);
      if (nextPage != null) {
        currentPage.value = nextPage;
      }
    }

    return Provider<OnNext>(
      create: (_) => onNext,
      child: SetupPageLayout(page: currentPage.value),
    );
  }
}
