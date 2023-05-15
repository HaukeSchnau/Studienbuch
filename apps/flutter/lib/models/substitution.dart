import 'package:class_companion_api/api.dart';

enum SubstitutionType {
  freisetzung,
  vertretung,
  betreuung,
  entfall,
}

final typeMap = {
  QuerySubstitutionsGet200ResponseInnerTypeEnum.BETREUUNG:
      SubstitutionType.betreuung,
  QuerySubstitutionsGet200ResponseInnerTypeEnum.ENTFALL:
      SubstitutionType.entfall,
  QuerySubstitutionsGet200ResponseInnerTypeEnum.FREISETZUNG:
      SubstitutionType.freisetzung,
  QuerySubstitutionsGet200ResponseInnerTypeEnum.VERTRETUNG:
      SubstitutionType.vertretung,
};

final typeStringMap = {
  SubstitutionType.betreuung: "Betreuung",
  SubstitutionType.entfall: "Entfall",
  SubstitutionType.freisetzung: "Freisetzung",
  SubstitutionType.vertretung: "Vertretung",
};

class Substitution {
  SubstitutionType type;

  Substitution({
    required this.type,
  });
}
