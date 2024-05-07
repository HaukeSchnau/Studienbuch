import 'package:class_mate/api/api.dart';
import 'package:flutter/foundation.dart';
import 'package:http/retry.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

Uri? _parseAndValidateBaseUri(String? baseUri) {
  if (baseUri == null) {
    return null;
  }

  final parsed = Uri.tryParse(baseUri);
  if (parsed == null) {
    return null;
  }

  if (parsed.host.isEmpty || parsed.scheme.isEmpty) {
    return null;
  }

  return parsed;
}

class Client extends ApiClient {
  final ValueNotifier<Uri> _baseUri =
      ValueNotifier(Uri.https('studienbuch.app'));

  Client({super.client});

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final server = prefs.getString("server");
    baseUriString = server;
  }

  @override
  Uri get baseUri => _baseUri.value;

  set baseUri(Uri uri) {
    _baseUri.value = uri;

    SharedPreferences.getInstance().then((prefs) {
      prefs.setString("server", uri.toString());
    });
  }

  set baseUriString(String? uri) {
    final parsed = _parseAndValidateBaseUri(uri);
    if (parsed != null) {
      baseUri = parsed;
    }
  }

  ValueListenable<Uri> get baseUriListenable => _baseUri;
}

final api = Client(
    client: RetryClient(
  http.Client(),
  when: (response) => response.statusCode >= 500 || response.statusCode == 408,
  whenError: (error, stacktrace) => error is http.ClientException,
));
