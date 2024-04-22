import 'package:class_mate/api/api.dart';
import 'package:flutter/foundation.dart';
import 'package:http/retry.dart';
import 'package:http/http.dart' as http;

final api = ApiClient(
    baseUri: kDebugMode
        ? Uri.http('192.168.178.21:3000')
        : Uri.https('studienbuch.app'),
    client: RetryClient(
      http.Client(),
      when: (response) =>
          response.statusCode >= 500 || response.statusCode == 408,
      whenError: (error, stacktrace) => error is http.ClientException,
    ));
