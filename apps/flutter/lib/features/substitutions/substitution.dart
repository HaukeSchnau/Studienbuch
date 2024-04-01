import 'package:class_mate/api/types.dart';

enum SubstitutionType {
  freisetzung,
  vertretung,
  betreuung,
  entfall,
}

final typeMap = {
  SubstitutionsGetOutputTypeEnum.betreuung: SubstitutionType.betreuung,
  SubstitutionsGetOutputTypeEnum.entfall: SubstitutionType.entfall,
  SubstitutionsGetOutputTypeEnum.freisetzung: SubstitutionType.freisetzung,
  SubstitutionsGetOutputTypeEnum.vertretung: SubstitutionType.vertretung,
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
