import 'package:flutter/widgets.dart';

class DummyPage extends StatelessWidget {
  const DummyPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const Placeholder(
      child: Center(
        child: Text(
          "This is a dummy page. Replace it with your own content.",
        ),
      ),
    );
  }
}
