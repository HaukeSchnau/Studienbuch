import 'package:class_mate/pages/trial_over_page.dart';
import 'package:go_router/go_router.dart';

final trialEnd = DateTime(2023, 8, 16);
final today = DateTime.now();
final isTrial = today.isBefore(trialEnd);

GoRouter buildTrialOverRouter() {
  return GoRouter(routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const TrialOverPage(),
    ),
  ]);
}
