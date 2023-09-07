import 'package:class_mate_api/api.dart';
import 'package:openapi_generator_annotations/openapi_generator_annotations.dart';

@Openapi(
  additionalProperties: AdditionalProperties(
    pubName: 'class_mate_api',
    pubAuthor: 'Hauke Schnau',
  ),
  inputSpecFile: 'https://classmate.haukeschnau.de/api/openapi.json',
  generatorName: Generator.dart,
  outputDirectory: 'api',
  alwaysRun: true,
  overwriteExistingFiles: true,
)
class MyOpenApi {}

final apiInstance =
    DefaultApi(ApiClient(basePath: "https://classmate.haukeschnau.de/api"));
