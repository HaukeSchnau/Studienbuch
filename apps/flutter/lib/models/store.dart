import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:class_companion/models/substitution_plan.dart';
import 'package:class_companion/models/user.dart';
import 'package:class_companion/static/colors.dart';
import 'package:encrypt/encrypt.dart';
import 'package:mobx/mobx.dart';
import 'package:path_provider/path_provider.dart';

part 'store.g.dart';

class GlobalStore = _GlobalStore with _$GlobalStore;

abstract class _GlobalStore with Store {
  @observable
  User currentUser;

  @observable
  List<SubstitutionPlan> substitutionPlan = [];

  @observable
  MyTheme theme = getDefaultTheme();

  @observable
  String licenseKey;

  _GlobalStore(
      {required this.currentUser,
      required this.licenseKey,
      this.substitutionPlan = const []}) {
    Timer.periodic(const Duration(seconds: 5), (timer) {
      // TODO find a better way to save the store on changes (mobx?)
      save();
    });

    // React on every change
    autorun((_) {
      save();
      toJson();
    });
  }

  _GlobalStore.fromJson(Map<String, dynamic> json)
      : this(
          currentUser: User.fromJson(json["currentUser"]),
          substitutionPlan: (json["substitutionPlan"] as List)
              .map<SubstitutionPlan>((e) => SubstitutionPlan.fromJson(e))
              .toList(),
          licenseKey: json["licenseKey"],
        );

  Map<String, dynamic> toJson() {
    return {
      "currentUser": currentUser.toJson(),
      "substitutionPlan": substitutionPlan.map((e) => e.toJson()).toList(),
      "theme": theme.toJson(),
      "licenseKey": licenseKey,
    };
  }

  Uint8List encrypt() {
    final cleartext = jsonEncode(this);
    final key = Key.fromUtf8("y\$B&E)H@McQfTjWn");
    final iv = IV.fromLength(16);

    final encrypter = Encrypter(AES(key));
    return encrypter.encrypt(cleartext, iv: iv).bytes;
  }

  Future<void> save() async {
    final directory = await getApplicationDocumentsDirectory();
    final storeFilePath = "${directory.path}/haukestore";
    final storeFile = File(storeFilePath);
    await storeFile.writeAsBytes(encrypt());
  }
}

String decrypt(Uint8List encryptedBytes) {
  final key = Key.fromUtf8("y\$B&E)H@McQfTjWn");
  final iv = IV.fromLength(16);
  final encrypter = Encrypter(AES(key));
  final encrypted = Encrypted(encryptedBytes);
  final decrypted = encrypter.decrypt(encrypted, iv: iv);
  return decrypted;
}

Future<GlobalStore?> loadStore() async {
  final directory = await getApplicationDocumentsDirectory();
  final storeFilePath = "${directory.path}/haukestore";
  final storeFile = File(storeFilePath);
  if (await storeFile.exists()) {
    final jsonContent = decrypt(await storeFile.readAsBytes());
    final store = GlobalStore.fromJson(jsonDecode(jsonContent));
    return store;
  }
  return null;
}
