import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:path_provider/path_provider.dart';

String? useAppDir() {
  final appDir = useState<String?>(null);

  useEffect(() {
    getApplicationDocumentsDirectory().then((value) {
      appDir.value = value.path;
    });
    return null;
  }, []);

  return appDir.value;
}
