import 'package:class_mate/features/debug/use_is_debug.dart';
import 'package:class_mate/infrastructure/api.dart';
import 'package:class_mate/presentation/colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum Server {
  local,
  beta,
  prod;

  const Server();

  factory Server.fromUri(Uri uri) {
    if (uri.host == "studienbuch.app") {
      return Server.prod;
    } else if (uri.host == "beta.studienbuch.app") {
      return Server.beta;
    } else {
      return Server.local;
    }
  }

  Uri? toUri() {
    switch (this) {
      case Server.prod:
        return Uri.https("studienbuch.app");
      case Server.beta:
        return Uri.https("beta.studienbuch.app");
      case Server.local:
        return null;
    }
  }
}

Server useStoredServer() {
  final server = useState<Server>(Server.prod);

  useEffect(() {
    SharedPreferences.getInstance().then((prefs) {
      final uri = Uri.tryParse(prefs.getString("server") ?? "");
      if (uri != null) {
        server.value = Server.fromUri(uri);
      }
    });
    return null;
  }, []);

  return server.value;
}

class DebugPage extends HookWidget {
  const DebugPage({super.key});

  @override
  Widget build(BuildContext context) {
    final storedServer = useStoredServer();
    final selectedServer = useState<Server?>(null);
    final currentServer = selectedServer.value ?? storedServer;

    final initialUri = api.baseUri;
    final customUriController =
        useTextEditingController(text: initialUri.toString());

    return Scaffold(
      appBar: AppBar(
        title: const Text("Debug"),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 16, top: 15),
            child: Text("Backend-Server",
                style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: theme.primaryText)),
          ),
          RadioListTile.adaptive(
              value: Server.prod,
              groupValue: currentServer,
              onChanged: (value) async {
                final newVal = value ?? Server.prod;
                selectedServer.value = newVal;
                api.baseUri = newVal.toUri()!;
              },
              title: const Text("Produktion")),
          RadioListTile.adaptive(
              value: Server.beta,
              groupValue: currentServer,
              onChanged: (value) async {
                final newVal = value ?? Server.prod;
                selectedServer.value = newVal;
                api.baseUri = newVal.toUri()!;
              },
              title: const Text("Beta")),
          RadioListTile.adaptive(
              value: Server.local,
              groupValue: currentServer,
              onChanged: (value) async {
                selectedServer.value = value ?? Server.prod;
                api.baseUriString = customUriController.text;
              },
              title: const Text("Lokal")),
          if (currentServer == Server.local)
            Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: TextField(
                  decoration: const InputDecoration(
                    labelText: "Custom URI",
                  ),
                  controller: customUriController,
                  onChanged: (value) {
                    api.baseUriString = value;
                  },
                )),
          const Divider(
            color: Colors.black12,
            height: 64,
          ),
          Align(
            alignment: Alignment.bottomRight,
            child: Padding(
              padding: const EdgeInsets.only(right: 16.0, bottom: 16.0),
              child: ElevatedButton(
                  child: const Text("Debug-Modus deaktivieren",
                      style: TextStyle(color: Colors.white)),
                  onPressed: () async {
                    await setDebug(false);
                    Navigator.of(context).pop();
                  }),
            ),
          )
        ],
      ),
    );
  }
}
