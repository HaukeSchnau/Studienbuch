import 'package:class_mate_api/api.dart';

enum SubstitutionType {
  freisetzung,
  vertretung,
  betreuung,
  entfall,
}

final typeMap = {
  SubstitutionsGet200ResponseInnerTypeEnum.BETREUUNG:
      SubstitutionType.betreuung,
  SubstitutionsGet200ResponseInnerTypeEnum.ENTFALL: SubstitutionType.entfall,
  SubstitutionsGet200ResponseInnerTypeEnum.FREISETZUNG:
      SubstitutionType.freisetzung,
  SubstitutionsGet200ResponseInnerTypeEnum.VERTRETUNG:
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
