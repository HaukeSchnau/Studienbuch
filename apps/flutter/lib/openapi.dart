import 'package:flutter/foundation.dart';
import 'package:openapi_generator_annotations/openapi_generator_annotations.dart';
import 'package:class_mate_api/api.dart';

@Openapi(
  additionalProperties: AdditionalProperties(
    pubName: 'class_mate_api',
    pubAuthor: 'Hauke Schnau',
  ),
  inputSpecFile: 'http://localhost:3000/api/openapi.json',
  generatorName: Generator.dart,
  outputDirectory: 'api',
  alwaysRun: true,
  overwriteExistingFiles: true,
)
class MyOpenApi extends OpenapiGeneratorConfig {}

final apiInstance = DefaultApi(ApiClient(
    basePath: kDebugMode
        ? "http://192.168.2.105:3000/api"
        : "https://classmate.haukeschnau.de/api"));
