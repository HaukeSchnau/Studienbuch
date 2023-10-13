import 'dart:async';
import 'dart:ui';

import 'package:class_mate/static/colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:provider/provider.dart';
import 'package:tutorial_coach_mark/tutorial_coach_mark.dart';

typedef TutorialKeys<TKeyIds> = Map<TKeyIds, GlobalKey>;
typedef TutorialKeyNotifier<TKeyIds> = ValueNotifier<TutorialKeys<TKeyIds>>;

typedef TargetFocusBuilder<TKeyIds> = List<TargetFocus> Function(
    TutorialKeys<TKeyIds> tutorialKeys);

class TutorialProvider<TKeyIds> extends HookWidget {
  final Widget child;
  final TargetFocusBuilder<TKeyIds> targetFocusBuilder;
  final TutorialKeys<TKeyIds> initialTutorialKeys;
  final FutureOr<void> Function(TargetFocus)? onClickTarget;
  final VoidCallback onFinish;
  final bool showTutorial;

  const TutorialProvider(
      {super.key,
      required this.child,
      required this.targetFocusBuilder,
      required this.initialTutorialKeys,
      required this.onFinish,
      required this.showTutorial,
      this.onClickTarget});

  TutorialCoachMark _createTutorial(TutorialKeys<TKeyIds> tutorialKeys) {
    return TutorialCoachMark(
      targets: targetFocusBuilder(tutorialKeys),
      colorShadow: theme.secondary,
      textSkip: "SKIP",
      textStyleSkip: const TextStyle(
        fontSize: 16.0,
        color: Colors.white,
      ),
      onClickTarget: onClickTarget,
      onFinish: onFinish,
      onSkip: onFinish,
      alignSkip: Alignment.topRight,
      paddingFocus: 0,
      opacityShadow: 0.6,
      imageFilter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tutorialKeys = useState<TutorialKeys<TKeyIds>>(initialTutorialKeys);

    useEffect(() {
      if (showTutorial) {
        Future.delayed(const Duration(milliseconds: 500)).then((value) =>
            _createTutorial(tutorialKeys.value).show(context: context));
      }

      return null;
    }, []);

    return ChangeNotifierProvider<TutorialKeyNotifier>.value(
        value: tutorialKeys, child: child);
  }
}
