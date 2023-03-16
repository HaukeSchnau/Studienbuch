import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class ProfilePage extends HookWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mein Profil'),
      ),
    );
  }
}
