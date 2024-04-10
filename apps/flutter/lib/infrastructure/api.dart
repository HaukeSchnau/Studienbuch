import 'package:class_mate/api/api.dart';
import 'package:http/retry.dart';
import 'package:http/http.dart' as http;

final api = ApiClient(
    baseUri: Uri.parse('https://studienbuch.app/api/trpc'),
    client: RetryClient(
      http.Client(),
      when: (response) =>
          response.statusCode >= 500 || response.statusCode == 408,
      whenError: (error, stacktrace) => error is http.ClientException,
    ));
