import 'package:class_mate/infrastructure/error_catcher.dart';
import 'package:class_mate/infrastructure/hooks/use_has_network.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:http/http.dart';

T? useNetworkResult<T>(
    Future<T> Function() future, void Function(Object cause) onError,
    [List<Object?> keys = const []]) {
  final result = useState<T?>(null);
  final context = useContext();
  final hasNetwork = useHasNetwork();
  final scaffoldMessenger = ScaffoldMessenger.of(context);

  useEffect(() {
    bool hadError = false;

    makeRequest() async {
      try {
        result.value = await future();
      } on ClientException catch (e) {
        hadError = true;

        debugPrint(e.toString());

        showErrorWithScaffold(
            scaffoldMessenger,
            UserVisibleError(
              "Du bist offline. Bitte überprüfe deine Internetverbindung",
              sticky: true,
            ));

        await Future.delayed(const Duration(seconds: 3));

        await makeRequest();
      } catch (e) {
        debugPrint(e.toString());
        onError(e);
        rethrow;
      }

      scaffoldMessenger.clearSnackBars();

      if (hadError) {
        showErrorWithScaffold(
            scaffoldMessenger,
            UserVisibleError(
              "Verbindung wiederhergestellt! 🚀",
              type: FlashType.success,
            ));
      }
    }

    if (hasNetwork != null && hasNetwork) {
      makeRequest();
    }
    return null;
  }, [hasNetwork, ...keys]);
  return result.value;
}
