// Openapi Generator last run: : 2024-02-05T16:11:02.696616
import 'package:class_mate_api/api.dart';
import 'package:openapi_generator_annotations/openapi_generator_annotations.dart';

@Openapi(
  additionalProperties: AdditionalProperties(
    pubName: 'class_mate_api',
    pubAuthor: 'Hauke Schnau',
  ),
  inputSpec: RemoteSpec(path: 'https://studienbuch.app/api/openapi.json'),
  generatorName: Generator.dart,
  outputDirectory: 'api',
)
class MyOpenApi {}

final apiInstance =
    DefaultApi(ApiClient(basePath: "https://studienbuch.app/api"));
