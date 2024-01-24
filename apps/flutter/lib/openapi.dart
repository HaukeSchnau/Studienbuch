// Openapi Generator last run: : 2024-01-24T19:58:45.299756
import 'package:class_mate_api/api.dart';
import 'package:openapi_generator_annotations/openapi_generator_annotations.dart';

@Openapi(
  additionalProperties: AdditionalProperties(
    pubName: 'class_mate_api',
    pubAuthor: 'Hauke Schnau',
  ),
  inputSpec: RemoteSpec(path: 'https://classmate.haukeschnau.de/api/openapi.json'),
  generatorName: Generator.dart,
  outputDirectory: 'api',
)
class MyOpenApi {}

final apiInstance =
    DefaultApi(ApiClient(basePath: "https://classmate.haukeschnau.de/api"));