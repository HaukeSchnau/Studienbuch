import 'package:class_mate/presentation/components/logo.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:package_info_plus/package_info_plus.dart';

PackageInfo? usePackageInfo() {
  final packageInfo = useState<PackageInfo?>(null);

  useEffect(() {
    PackageInfo.fromPlatform().then((info) => packageInfo.value = info);
    return null;
  }, const []);

  return packageInfo.value;
}

class AboutPage extends HookWidget {
  const AboutPage({super.key});

  @override
  Widget build(BuildContext context) {
    final packageInfo = usePackageInfo();

    return LicensePage(
      applicationIcon: const Logo(),
      applicationName: "Studienbuch: IGS Lilienthal",
      applicationVersion:
          packageInfo != null ? "Version ${packageInfo.version}" : null,
      applicationLegalese: "© ${DateTime.now().year.toString()} Hauke Schnau",
    );
  }
}
