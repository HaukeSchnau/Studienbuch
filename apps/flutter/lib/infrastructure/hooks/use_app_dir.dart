import 'dart:io';

import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:path_provider/path_provider.dart';

Directory? useAppDir() {
  final appDir = useState<Directory?>(null);

  useEffect(() {
    getApplicationDocumentsDirectory().then((value) {
      appDir.value = value;
    });
    return null;
  }, []);

  return appDir.value;
}

File? useFile(String pathRelativeToAppDir) {
  final appDir = useAppDir();
  final file = useMemoized(
      () =>
          appDir != null ? File("${appDir.path}/$pathRelativeToAppDir") : null,
      [appDir]);

  final fileOrNull = useState<File?>(null);

  useEffect(() {
    if (file == null) {
      return;
    }

    _returnFileIfExists(file).then((value) {
      fileOrNull.value = value;
    });
    return null;
  }, [file]);

  return fileOrNull.value;
}

Future<File?> _returnFileIfExists(File file) async {
  if (await file.exists()) {
    return file;
  }

  return null;
}
