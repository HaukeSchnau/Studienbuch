import 'package:class_mate/infrastructure/error_catcher.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

bool checkHasNetwork(List<ConnectivityResult> data) {
  return (data.contains(ConnectivityResult.wifi) ||
      data.contains(ConnectivityResult.mobile));
}

final stream = Connectivity().onConnectivityChanged;
bool? useHasNetwork() {
  final connectivity = useStream(stream);
  final future = useMemoized(() => Connectivity().checkConnectivity());
  final futureValue = useFuture(future);

  final streamData = connectivity.data;
  final data = futureValue.data;

  if (streamData != null) {
    return checkHasNetwork(streamData);
  }

  if (data != null) {
    return checkHasNetwork(data);
  }

  return null;
}

bool useHasNetworkWithNotice() {
  final hasNetwork = useHasNetwork();
  final context = useContext();
  final scaffoldMessenger = ScaffoldMessenger.of(context);

  final prevHasNetwork = useRef(hasNetwork);
  useEffect(() {
    if (hasNetwork == null) {
      return null;
    }

    if (!hasNetwork) {
      ScaffoldFeatureController<SnackBar, SnackBarClosedReason>? controller;
      SchedulerBinding.instance.addPostFrameCallback((_) {
        controller = showErrorWithScaffold(
            scaffoldMessenger,
            UserVisibleError(
                "Du bist offline. Bitte stelle deine Verbindung wieder her, um fortzufahren.",
                sticky: true));
      });

      prevHasNetwork.value = hasNetwork;

      return () {
        try {
          controller?.close();
          // ignore: empty_catches
        } catch (e) {}
      };
    } else if (prevHasNetwork.value == false) {
      ScaffoldFeatureController<SnackBar, SnackBarClosedReason>? controller;
      SchedulerBinding.instance.addPostFrameCallback((_) {
        controller = showErrorWithScaffold(
            scaffoldMessenger,
            UserVisibleError("Verbindung wiederhergestellt! 🚀",
                type: FlashType.success));
      });

      prevHasNetwork.value = hasNetwork;

      return () {
        try {
          controller?.close();
          // ignore: empty_catches
        } catch (e) {}
      };
    }

    return null;
  }, [hasNetwork]);

  return hasNetwork ?? true;
}
